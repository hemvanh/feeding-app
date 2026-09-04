import { getGitHubSettings, guessGitHubRepo } from '../github'
import type { Pet } from '../types'

export function coverPhotoPath(petId: string): string {
  return `pet-photos/${petId}.jpg`
}

export function coverPhotoUrl(pet: Pet): string | null {
  if (!pet.coverAt) return null
  const guessed = guessGitHubRepo()
  const { owner, repo } = getGitHubSettings()
  const o = owner || guessed?.owner
  const r = repo || guessed?.repo
  if (!o || !r) return null
  const stamp = encodeURIComponent(pet.coverAt)
  if (window.location.hostname.endsWith('.github.io')) {
    const folder = window.location.pathname.replace(/\/index\.html$/i, '').replace(/\/$/, '')
    return `${window.location.origin}${folder}/pet-photos/${pet.id}.jpg?t=${stamp}`
  }
  return `https://raw.githubusercontent.com/${o}/${r}/main/pet-photos/${pet.id}.jpg?t=${stamp}`
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
