const TOKEN_KEY = 'reptile-feed-gh-token'
const OWNER_KEY = 'reptile-feed-gh-owner'
const REPO_KEY = 'reptile-feed-gh-repo'
const ON_KEY = 'reptile-feed-gh-connected'
const FILE_PATH = 'feeding-data.json'

let lastSha = ''

export type GitHubSettings = {
  token: string
  owner: string
  repo: string
}

export function canUseGitHubSync(): boolean {
  return window.isSecureContext && window.location.protocol !== 'file:'
}

export function guessGitHubRepo(): { owner: string; repo: string } | null {
  const host = window.location.hostname
  if (!host.endsWith('.github.io')) return null
  const owner = host.slice(0, -'.github.io'.length)
  const parts = window.location.pathname.replace(/index\.html$/i, '').split('/').filter(Boolean)
  if (!parts.length) return { owner, repo: `${owner}.github.io` }
  return { owner, repo: parts[0] }
}

function pagesUrlFor(owner: string, repo: string): string | null {
  const o = owner.trim()
  const r = repo.trim()
  if (!o || !r) return null
  if (r === `${o}.github.io`) return `https://${o}.github.io/`
  return `https://${o}.github.io/${r}/`
}

/** Live GitHub Pages origin+path (no hash), so printed QR codes work off localhost. */
export function githubPagesBaseUrl(): string {
  if (typeof window !== 'undefined' && window.location.hostname.endsWith('.github.io')) {
    const path = window.location.pathname.replace(/index\.html$/i, '')
    const dir = !path || path === '/' ? '/' : path.endsWith('/') ? path : `${path}/`
    return `${window.location.origin}${dir}`
  }
  const settings = typeof window !== 'undefined' ? getGitHubSettings() : { token: '', owner: '', repo: '' }
  return pagesUrlFor(settings.owner, settings.repo) ?? 'https://hemvanh.github.io/feeding-app/'
}

export function getGitHubSettings(): GitHubSettings {
  const guessed = typeof window !== 'undefined' ? guessGitHubRepo() : null
  return {
    token: localStorage.getItem(TOKEN_KEY) ?? '',
    owner: localStorage.getItem(OWNER_KEY) || guessed?.owner || '',
    repo: localStorage.getItem(REPO_KEY) || guessed?.repo || '',
  }
}

export function saveGitHubSettings(settings: GitHubSettings) {
  localStorage.setItem(TOKEN_KEY, settings.token.trim())
  localStorage.setItem(OWNER_KEY, settings.owner.trim())
  localStorage.setItem(REPO_KEY, settings.repo.trim())
}

export function isGitHubConnected(): boolean {
  if (localStorage.getItem(ON_KEY) !== '1') return false
  const { token, owner, repo } = getGitHubSettings()
  return Boolean(token && owner && repo)
}

export function setGitHubConnected(on: boolean) {
  if (on) localStorage.setItem(ON_KEY, '1')
  else localStorage.removeItem(ON_KEY)
  lastSha = ''
}

function toBase64(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let binary = ''
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte)
  })
  return btoa(binary)
}

function fromBase64(encoded: string): string {
  const binary = atob(encoded.replace(/\s/g, ''))
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

async function requestContents(path: string, method: string, body?: unknown): Promise<Response> {
  const { token, owner, repo } = getGitHubSettings()
  if (!token || !owner || !repo) throw new Error('Paste GitHub owner, repo, and token first.')
  return fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, {
    method,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
}

function bytesToBase64(bytes: Uint8Array): string {
  const chunk = 0x8000
  let binary = ''
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

async function fileSha(path: string): Promise<string | null> {
  const response = await requestContents(path, 'GET')
  if (response.status === 404) return null
  if (!response.ok) throw new Error(await readError(response))
  const data = (await response.json()) as { sha: string }
  return data.sha
}

export async function putGitHubBytes(path: string, bytes: Uint8Array, message: string) {
  const sha = await fileSha(path)
  const response = await requestContents(path, 'PUT', {
    message,
    content: bytesToBase64(bytes),
    ...(sha ? { sha } : {}),
  })
  if (!response.ok) throw new Error(await readError(response))
}

export async function deleteGitHubFile(path: string, message: string) {
  const sha = await fileSha(path)
  if (!sha) return
  const response = await requestContents(path, 'DELETE', {
    message,
    sha,
  })
  if (!response.ok && response.status !== 404) throw new Error(await readError(response))
}

async function readError(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as { message?: string }
    if (data.message) return data.message
  } catch {
    /* ignore */
  }
  return `GitHub request failed (${response.status})`
}

export async function pullGitHubJson(): Promise<string | null> {
  const response = await requestContents(FILE_PATH, 'GET')
  if (response.status === 404) {
    lastSha = ''
    return null
  }
  if (!response.ok) throw new Error(await readError(response))
  const data = (await response.json()) as { sha: string; content: string; encoding: string }
  lastSha = data.sha
  return fromBase64(data.content)
}

export async function pushGitHubJson(text: string) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await requestContents(FILE_PATH, 'PUT', {
      message: 'Update feeding data',
      content: toBase64(text),
      ...(lastSha ? { sha: lastSha } : {}),
    })
    if (response.status === 409 || response.status === 422) {
      await pullGitHubJson()
      continue
    }
    if (!response.ok) throw new Error(await readError(response))
    const data = (await response.json()) as { content?: { sha?: string } }
    if (data.content?.sha) lastSha = data.content.sha
    return
  }
  throw new Error('Could not update feeding-data.json (file changed on GitHub). Try again.')
}
