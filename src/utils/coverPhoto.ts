import { useSyncExternalStore } from 'react'
import { getGitHubSettings, guessGitHubRepo } from '../github'
import type { Pet } from '../types'

const localCoverUrls = new Map<string, string>()
const localCoverListeners = new Set<() => void>()
let localCoverVersion = 0

function emitLocalCovers() {
  localCoverVersion += 1
  for (const listener of localCoverListeners) listener()
}

function subscribeLocalCovers(listener: () => void) {
  localCoverListeners.add(listener)
  return () => {
    localCoverListeners.delete(listener)
  }
}

function localCoverVersionSnapshot() {
  return localCoverVersion
}

export function setLocalCoverPreview(petId: string, bytes: Uint8Array | null) {
  const previous = localCoverUrls.get(petId)
  if (previous) URL.revokeObjectURL(previous)
  if (!bytes) {
    localCoverUrls.delete(petId)
    emitLocalCovers()
    return
  }
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  localCoverUrls.set(petId, URL.createObjectURL(new Blob([copy], { type: 'image/jpeg' })))
  emitLocalCovers()
}

export function coverPhotoPath(petId: string, coverAt?: string): string {
  if (coverAt && /^\d+$/.test(coverAt)) return `pet-photos/${petId}-${coverAt}.jpg`
  return `pet-photos/${petId}.jpg`
}

export function coverPhotoUrl(pet: Pet): string | null {
  if (!pet.coverAt) return null
  const guessed = guessGitHubRepo()
  const { owner, repo } = getGitHubSettings()
  const o = owner || guessed?.owner
  const r = repo || guessed?.repo
  if (!o || !r) return null
  const file = coverPhotoPath(pet.id, pet.coverAt)
  if (window.location.hostname.endsWith('.github.io')) {
    const folder = window.location.pathname.replace(/\/index\.html$/i, '').replace(/\/$/, '')
    return `${window.location.origin}${folder}/${file}`
  }
  return `https://raw.githubusercontent.com/${o}/${r}/main/${file}`
}

export function useCoverSrc(pet: Pet): string | null {
  useSyncExternalStore(subscribeLocalCovers, localCoverVersionSnapshot, localCoverVersionSnapshot)
  return localCoverUrls.get(pet.id) ?? coverPhotoUrl(pet)
}

export async function compressCover(file: File): Promise<Uint8Array> {
  const bitmap = await imageBitmapFromFile(file)
  const max = 900
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height))
  const width = Math.max(1, Math.round(bitmap.width * scale))
  const height = Math.max(1, Math.round(bitmap.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not prepare this photo.')
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close?.()
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((next) => (next ? resolve(next) : reject(new Error('Could not compress this photo.'))), 'image/jpeg', 0.82)
  })
  return new Uint8Array(await blob.arrayBuffer())
}

async function imageBitmapFromFile(file: File): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file)
  } catch {
    const url = URL.createObjectURL(file)
    try {
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image()
        el.onload = () => resolve(el)
        el.onerror = () => reject(new Error('This photo could not be opened. Try JPEG or PNG from Photos.'))
        el.src = url
      })
      const canvas = document.createElement('canvas')
      canvas.width = image.naturalWidth
      canvas.height = image.naturalHeight
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Could not prepare this photo.')
      ctx.drawImage(image, 0, 0)
      return await createImageBitmap(canvas)
    } finally {
      URL.revokeObjectURL(url)
    }
  }
}
