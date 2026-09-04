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

async function request(method: string, body?: unknown): Promise<Response> {
  const { token, owner, repo } = getGitHubSettings()
  if (!token || !owner || !repo) throw new Error('Paste GitHub owner, repo, and token first.')
  return fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${FILE_PATH}`, {
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
  const response = await request('GET')
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
    const response = await request('PUT', {
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
