/**
 * All Pets and Pending stay on one history entry. Deeper pages push.
 * Returning to either list rewinds this visit's entries, so the phone Back
 * button leaves the app instead of opening an earlier feeding or list.
 * Entries from before this visit stay; a page cannot delete those.
 */

type HistState = { rfDepth?: number }

type HistEntry = { url?: string; index?: number; sameDocument?: boolean; id?: string }

type LooseNavigate = {
  navigationType?: string
  cancelable?: boolean
  preventDefault?: () => void
  destination?: { url?: string; index?: number }
}

type AppNav = {
  entries?: () => HistEntry[]
  currentEntry?: HistEntry | null
  addEventListener?: (type: string, listener: (event: LooseNavigate) => void) => void
}

let listener: () => void = () => {}
let started = false
let settlingRoot: string | null = null
let settleToken = 0
let suppressExit = 0

function appNavigation(): AppNav | null {
  const nav = (window as Window & { navigation?: AppNav }).navigation
  if (!nav?.entries || !nav.currentEntry) return null
  return nav
}

function barePath(path: string) {
  const raw = path.startsWith('#') ? path.slice(1) : path
  return raw.split('?')[0] || '/'
}

function currentPath() {
  return window.location.hash.replace(/^#/, '') || '/'
}

export function isRootPath(path: string) {
  const bare = barePath(path)
  return bare === '/' || bare === '/pending'
}

function historyLevel(path: string) {
  const bare = barePath(path)
  if (isRootPath(bare)) return 0
  if (/^\/pet\/[^/]+$/.test(bare)) return 1
  return 2
}

function readDepth() {
  const state = history.state as HistState | null
  return state && typeof state.rfDepth === 'number' ? state.rfDepth : 0
}

function urlFor(path: string) {
  const next = new URL(window.location.href)
  next.hash = path
  return next.href
}

function isAppUrl(url: string) {
  try {
    const next = new URL(url)
    return next.origin === window.location.origin && next.pathname === window.location.pathname
  } catch {
    return false
  }
}

function appEntriesBehind() {
  const nav = appNavigation()
  if (!nav?.entries || !nav.currentEntry) return 0
  const entries = nav.entries()
  const index = nav.currentEntry.index ?? entries.findIndex((entry) => entry.id === nav.currentEntry?.id)
  if (index <= 0) return 0
  let first = index
  for (let i = index - 1; i >= 0; i--) {
    const entry = entries[i]
    if (!entry || entry.sameDocument !== true || !entry.url || !isAppUrl(entry.url)) break
    first = i
  }
  return index - first
}

function notify() {
  window.dispatchEvent(new HashChangeEvent('hashchange'))
}

function finishSettle(path: string, token: number) {
  if (token !== settleToken || settlingRoot !== path) return
  settleToken += 1
  settlingRoot = null
  history.replaceState({ rfDepth: 0 }, '', urlFor(path))
  notify()
}

function beginSettle(path: string, steps: number) {
  const pop = Math.min(steps, 50)
  if (pop <= 0) {
    history.replaceState({ rfDepth: 0 }, '', urlFor(path))
    notify()
    return
  }
  const token = ++settleToken
  settlingRoot = path
  suppressExit += 1
  history.go(-pop)
  window.setTimeout(() => {
    suppressExit = Math.max(0, suppressExit - 1)
    finishSettle(path, token)
  }, 400)
}

function stepsToRoot() {
  const nav = appNavigation()
  if (nav) return appEntriesBehind()
  return readDepth()
}

function canPop(steps: number) {
  if (steps <= 0) return false
  const nav = appNavigation()
  if (nav) return appEntriesBehind() >= steps
  return readDepth() >= steps
}

function onHash() {
  if (settlingRoot) return
  listener()
}

function onPop() {
  if (settlingRoot) {
    finishSettle(settlingRoot, settleToken)
    return
  }
  if (isRootPath(currentPath())) {
    const steps = appEntriesBehind()
    if (steps > 0) {
      beginSettle(currentPath(), steps)
      return
    }
    history.replaceState({ rfDepth: 0 }, '')
  }
  notify()
}

function onNavigate(event: LooseNavigate) {
  if (suppressExit > 0 || settlingRoot) return
  if (event.navigationType !== 'traverse' || !event.cancelable || !event.preventDefault) return
  if (!isRootPath(currentPath())) return
  const destUrl = event.destination?.url
  if (!destUrl || !isAppUrl(destUrl)) return
  const nav = appNavigation()
  if (!nav?.entries || !nav.currentEntry) return
  const index = nav.currentEntry.index ?? 0
  const destIndex = event.destination?.index ?? index - 1
  if (destIndex >= index) return
  const entries = nav.entries()
  let firstApp = index
  for (let i = index; i >= 0; i--) {
    const entry = entries[i]
    if (!entry?.url || !isAppUrl(entry.url)) break
    firstApp = i
  }
  const exitIndex = firstApp - 1
  if (exitIndex < 0) return
  event.preventDefault()
  suppressExit += 1
  history.go(exitIndex - index)
  window.setTimeout(() => {
    suppressExit = Math.max(0, suppressExit - 1)
  }, 400)
}

function bootstrapHistory() {
  const path = currentPath()
  const root = isRootPath(path)
  const nav = appNavigation()
  const depth = root ? 0 : nav ? Math.max(1, appEntriesBehind()) : 0
  if (!window.location.hash || readDepth() !== depth) {
    history.replaceState({ rfDepth: depth }, '', urlFor(root || window.location.hash ? path : '/'))
  }
  if (root) {
    const steps = appEntriesBehind()
    if (steps > 0) beginSettle(path, steps)
  }
}

function ensureStarted() {
  if (started) return
  started = true
  window.addEventListener('hashchange', onHash)
  window.addEventListener('popstate', onPop)
  appNavigation()?.addEventListener?.('navigate', onNavigate)
  bootstrapHistory()
}

export function installHistory(next: () => void) {
  listener = next
  ensureStarted()
  return () => {
    if (listener === next) listener = () => {}
  }
}

export function go(path: string) {
  if (settlingRoot) return
  const here = currentPath()
  if (here === path) return
  const destLevel = historyLevel(path)
  const hereLevel = historyLevel(here)

  if (destLevel === 0) {
    if (hereLevel === 0) {
      history.replaceState({ rfDepth: 0 }, '', urlFor(path))
      notify()
      const steps = appEntriesBehind()
      if (steps > 0) beginSettle(path, steps)
      return
    }
    const steps = stepsToRoot()
    if (steps > 0) beginSettle(path, steps)
    else {
      history.replaceState({ rfDepth: 0 }, '', urlFor(path))
      notify()
    }
    return
  }

  if (destLevel < hereLevel) {
    const steps = hereLevel - destLevel
    if (canPop(steps)) {
      suppressExit += 1
      history.go(-steps)
      window.setTimeout(() => {
        suppressExit = Math.max(0, suppressExit - 1)
      }, 400)
      return
    }
    history.replaceState({ rfDepth: destLevel }, '', urlFor(path))
    notify()
    return
  }

  history.pushState({ rfDepth: readDepth() + 1 }, '', urlFor(path))
  notify()
}
