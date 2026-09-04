import Dexie, { type EntityTable } from 'dexie'
import bundledSeed from './data/feeding-data.json'
import { db } from './db'
import {
  canUseGitHubSync,
  getGitHubSettings,
  isGitHubConnected,
  pullGitHubJson,
  pushGitHubJson,
  setGitHubConnected,
} from './github'
import type { DataDump, FeedingEvent, Pet } from './types'

export const DATA_FILE_NAME = 'feeding-data.json'

type SyncMeta = {
  id: 'file'
  handle: FileSystemFileHandle
}

class SyncDB extends Dexie {
  meta!: EntityTable<SyncMeta, 'id'>

  constructor() {
    super('reptile-feeding-sync')
    this.version(1).stores({ meta: 'id' })
  }
}

const syncDb = new SyncDB()

export type SyncStatus = {
  connected: boolean
  fileName: string | null
  message: string
  canUseFileApi: boolean
  canUseGitHub: boolean
}

const listeners = new Set<() => void>()
let applyingRemote = false
let pushTimer: number | null = null
let lastPushedAt = ''
let lastAppliedAt = ''
let pollTimer: number | null = null

let status: SyncStatus = {
  connected: false,
  fileName: null,
  message:
    'On iPhone and PC, connect GitHub below so both use the same feeding-data.json. Chrome can also lock a local JSON file.',
  canUseFileApi: typeof window !== 'undefined' && 'showOpenFilePicker' in window,
  canUseGitHub: typeof window !== 'undefined' && canUseGitHubSync(),
}

function emit() {
  for (const listener of listeners) listener()
}

function setStatus(partial: Partial<SyncStatus>) {
  status = { ...status, ...partial }
  emit()
}

export function getSyncStatus(): SyncStatus {
  return status
}

export function subscribeSync(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function canUseFileApi(): boolean {
  return status.canUseFileApi
}

async function snapshot(): Promise<DataDump> {
  const [pets, feedings] = await Promise.all([db.pets.toArray(), db.feedings.toArray()])
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    pets,
    feedings,
  }
}

function parseDump(raw: unknown): DataDump | null {
  if (!raw || typeof raw !== 'object') return null
  const data = raw as Partial<DataDump>
  if (data.version !== 1 || !Array.isArray(data.pets) || !Array.isArray(data.feedings)) return null
  return {
    version: 1,
    updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : new Date().toISOString(),
    pets: data.pets as Pet[],
    feedings: data.feedings as FeedingEvent[],
  }
}

async function applyDump(dump: DataDump) {
  applyingRemote = true
  try {
    await db.transaction('rw', db.pets, db.feedings, async () => {
      await db.pets.clear()
      await db.feedings.clear()
      if (dump.pets.length) await db.pets.bulkPut(dump.pets)
      if (dump.feedings.length) await db.feedings.bulkPut(dump.feedings)
    })
    lastAppliedAt = dump.updatedAt
  } finally {
    applyingRemote = false
  }
}

async function getHandle(): Promise<FileSystemFileHandle | null> {
  const row = await syncDb.meta.get('file')
  return row?.handle ?? null
}

async function ensurePermission(
  handle: FileSystemFileHandle,
  mode: 'read' | 'readwrite',
): Promise<boolean> {
  const options = { mode }
  if ((await handle.queryPermission(options)) === 'granted') return true
  return (await handle.requestPermission(options)) === 'granted'
}

async function writeDump(handle: FileSystemFileHandle, dump: DataDump) {
  const writable = await handle.createWritable()
  await writable.write(`${JSON.stringify(dump, null, 2)}\n`)
  await writable.close()
  lastPushedAt = dump.updatedAt
}

async function readDump(handle: FileSystemFileHandle): Promise<DataDump | null> {
  const file = await handle.getFile()
  const text = (await file.text()).trim()
  if (!text) {
    return { version: 1, updatedAt: '1970-01-01T00:00:00.000Z', pets: [], feedings: [] }
  }
  try {
    return parseDump(JSON.parse(text))
  } catch {
    return null
  }
}

function githubLabel() {
  return `github:${DATA_FILE_NAME}`
}

export async function pushToFile() {
  const dump = await snapshot()
  const body = `${JSON.stringify(dump, null, 2)}\n`

  if (isGitHubConnected()) {
    await pushGitHubJson(body)
    lastPushedAt = dump.updatedAt
    setStatus({
      connected: true,
      fileName: DATA_FILE_NAME,
      message: 'Synced to GitHub feeding-data.json.',
    })
    return
  }

  const handle = await getHandle()
  if (!handle) return
  if (!(await ensurePermission(handle, 'readwrite'))) {
    setStatus({
      connected: false,
      message: 'Permission to write the data file was denied. Connect the file again.',
    })
    return
  }
  await writeDump(handle, dump)
  setStatus({
    connected: true,
    fileName: handle.name,
    message: `Synced to ${handle.name}`,
  })
}

function queuePush() {
  if (applyingRemote) return
  if (pushTimer !== null) window.clearTimeout(pushTimer)
  pushTimer = window.setTimeout(() => {
    void pushToFile().catch((error: unknown) => {
      console.error(error)
      setStatus({ message: error instanceof Error ? error.message : 'Could not write the data file.' })
    })
  }, 250)
}

async function pullFromFile() {
  if (isGitHubConnected()) {
    const text = await pullGitHubJson()
    if (text === null) {
      await pushToFile()
      return
    }
    const dump = parseDump(JSON.parse(text))
    if (!dump) {
      setStatus({ message: 'GitHub feeding-data.json is not valid JSON.' })
      return
    }
    if (dump.updatedAt === lastPushedAt || dump.updatedAt === lastAppliedAt) return
    const localCount = (await db.pets.count()) + (await db.feedings.count())
    if (!dump.pets.length && !dump.feedings.length && localCount > 0) {
      await pushToFile()
      return
    }
    await applyDump(dump)
    setStatus({
      connected: true,
      fileName: DATA_FILE_NAME,
      message: 'Loaded pets from GitHub.',
    })
    return
  }

  const handle = await getHandle()
  if (!handle) return
  if (!(await ensurePermission(handle, 'readwrite'))) return
  const dump = await readDump(handle)
  if (!dump) {
    setStatus({ message: 'The data file is not valid JSON. Export a backup, then reconnect.' })
    return
  }
  if (dump.updatedAt === lastPushedAt || dump.updatedAt === lastAppliedAt) return
  const localCount = (await db.pets.count()) + (await db.feedings.count())
  if (!dump.pets.length && !dump.feedings.length && localCount > 0) {
    await pushToFile()
    return
  }
  await applyDump(dump)
  setStatus({
    connected: true,
    fileName: handle.name,
    message: `Loaded ${handle.name}`,
  })
}

export async function connectExistingFile() {
  const [handle] = await window.showOpenFilePicker({
    multiple: false,
    types: [
      {
        description: 'Feeding data',
        accept: { 'application/json': ['.json'] },
      },
    ],
  })
  await syncDb.meta.put({ id: 'file', handle })
  if (!(await ensurePermission(handle, 'readwrite'))) {
    setStatus({ connected: false, message: 'Allow read and write access to that JSON file.' })
    return
  }
  const dump = await readDump(handle)
  const local = await snapshot()
  if (dump && (dump.pets.length || dump.feedings.length)) {
    await applyDump(dump)
  } else if (local.pets.length || local.feedings.length) {
    await writeDump(handle, { ...local, updatedAt: new Date().toISOString() })
  } else {
    const empty = await snapshot()
    await writeDump(handle, empty)
  }
  setStatus({
    connected: true,
    fileName: handle.name,
    message: `Using ${handle.name} as the shared database.`,
  })
}

export async function createDataFile() {
  const handle = await window.showSaveFilePicker({
    suggestedName: DATA_FILE_NAME,
    types: [
      {
        description: 'Feeding data',
        accept: { 'application/json': ['.json'] },
      },
    ],
  })
  await syncDb.meta.put({ id: 'file', handle })
  const dump = await snapshot()
  await writeDump(handle, dump)
  setStatus({
    connected: true,
    fileName: handle.name,
    message: `Created ${handle.name}.`,
  })
}

export async function connectGitHub() {
  const { token, owner, repo } = getGitHubSettings()
  if (!owner.trim() || !repo.trim() || !token.trim()) {
    throw new Error('Fill GitHub owner, repo, and personal access token first.')
  }
  setGitHubConnected(true)
  setStatus({
    connected: true,
    fileName: DATA_FILE_NAME,
    message: `Connected to ${githubLabel()}.`,
  })
  await pullFromFile()
}

export async function disconnectFile() {
  await syncDb.meta.delete('file')
  lastPushedAt = ''
  lastAppliedAt = ''
  if (isGitHubConnected()) setGitHubConnected(false)
  setStatus({
    connected: false,
    fileName: null,
    message: 'Disconnected. This browser will keep its own copy until you connect again.',
  })
}

export async function exportJsonFile() {
  const dump = await snapshot()
  const blob = new Blob([`${JSON.stringify(dump, null, 2)}\n`], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = DATA_FILE_NAME
  link.click()
  URL.revokeObjectURL(url)
}

export async function importJsonText(text: string) {
  const dump = parseDump(JSON.parse(text))
  if (!dump) throw new Error('Invalid data file')
  await applyDump(dump)
  queuePush()
}

export function initSync() {
  db.pets.hook('creating', () => queuePush())
  db.pets.hook('updating', () => queuePush())
  db.pets.hook('deleting', () => queuePush())
  db.feedings.hook('creating', () => queuePush())
  db.feedings.hook('updating', () => queuePush())
  db.feedings.hook('deleting', () => queuePush())

  void (async () => {
    const count = await db.pets.count()
    const seed = parseDump(bundledSeed)
    if (count === 0 && seed?.pets.length) {
      await applyDump(seed)
    }

    if (isGitHubConnected()) {
      setStatus({
        connected: true,
        fileName: DATA_FILE_NAME,
        canUseGitHub: canUseGitHubSync(),
        message: `Connected to ${githubLabel()}.`,
      })
      await pullFromFile()
      return
    }

    const handle = await getHandle()
    if (!handle) return
    const allowed = await ensurePermission(handle, 'readwrite')
    if (!allowed) {
      setStatus({
        connected: false,
        fileName: handle.name,
        message: 'Reconnect the local data file to sync this browser.',
      })
      return
    }
    setStatus({
      connected: true,
      fileName: handle.name,
      message: `Connected to ${handle.name}`,
    })
    await pullFromFile()
  })()

  if (pollTimer !== null) window.clearInterval(pollTimer)
  pollTimer = window.setInterval(() => {
    void pullFromFile().catch(console.error)
  }, 4000)
}
