import { githubPagesBaseUrl } from '../github'

export function petRecordUrl(petId: string): string {
  return `${githubPagesBaseUrl()}#/pet/${encodeURIComponent(petId)}`
}

export function petIdFromQrText(text: string): string | null {
  const raw = text.trim()
  if (!raw) return null
  let hash = ''
  try {
    hash = new URL(raw).hash.replace(/^#/, '')
  } catch {
    const hashAt = raw.indexOf('#')
    hash = hashAt >= 0 ? raw.slice(hashAt + 1) : raw
  }
  const match = hash.match(/^\/?pet\/([^/?#]+)/)
  if (!match) return null
  try {
    return decodeURIComponent(match[1])
  } catch {
    return match[1]
  }
}
