import type { Pet } from '../types'
import { coverPhotoPath, coverSrcCandidates } from './coverPhoto'

export type QrInk = {
  dark: string
  light: string
}

function hueDist(a: number, b: number): number {
  const d = Math.abs(a - b) % 360
  return d > 180 ? 360 - d : d
}

function hueFromId(id: string): number {
  let hash = 2166136261
  for (let i = 0; i < id.length; i++) {
    hash ^= id.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0) % 360
}

function hsl(h: number, s: number, l: number): string {
  return `hsl(${Math.round(h)} ${Math.round(s)}% ${Math.round(l)}%)`
}

export function colorsFromHue(hue: number): QrInk {
  return {
    dark: hsl(hue, 82, 34),
    light: hsl(hue, 48, 93),
  }
}

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  const rr = r / 255
  const gg = g / 255
  const bb = b / 255
  const max = Math.max(rr, gg, bb)
  const min = Math.min(rr, gg, bb)
  const l = (max + min) / 2
  if (max === min) return { h: 0, s: 0, l }
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h = 0
  if (max === rr) h = (gg - bb) / d + (gg < bb ? 6 : 0)
  else if (max === gg) h = (bb - rr) / d + 2
  else h = (rr - gg) / d + 4
  return { h: h * 60, s, l }
}

function coverUrlsForSampling(pet: Pet): string[] {
  const urls: string[] = []
  if (pet.coverAt) {
    urls.push(new URL(coverPhotoPath(pet.id, pet.coverAt), window.location.href).href)
  }
  for (const url of coverSrcCandidates(pet)) urls.push(url)
  return [...new Set(urls)]
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.referrerPolicy = 'no-referrer'
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('cover load failed'))
    img.src = url
  })
}

async function sampleCoverHue(pet: Pet): Promise<number | null> {
  for (const url of coverUrlsForSampling(pet)) {
    try {
      const img = await loadImage(url)
      const size = 48
      const canvas = document.createElement('canvas')
      canvas.width = size
      canvas.height = size
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      if (!ctx) continue
      ctx.drawImage(img, 0, 0, size, size)
      const { data } = ctx.getImageData(0, 0, size, size)
      const buckets = new Float64Array(36)
      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] < 200) continue
        const { h, s, l } = rgbToHsl(data[i], data[i + 1], data[i + 2])
        if (s < 0.18 || l < 0.12 || l > 0.9) continue
        const weight = s * (1 - Math.abs(l - 0.45) * 1.6)
        if (weight <= 0) continue
        buckets[Math.min(35, Math.floor(h / 10))] += weight
      }
      let best = -1
      let bestW = 0
      for (let i = 0; i < buckets.length; i++) {
        if (buckets[i] > bestW) {
          bestW = buckets[i]
          best = i
        }
      }
      if (best >= 0 && bestW > 0) return best * 10 + 5
    } catch {
      /* try the next cover URL */
    }
  }
  return null
}

function spreadHues(preferred: number[]): number[] {
  const n = preferred.length
  const minGap = Math.min(52, Math.max(24, Math.floor(360 / (n + 1))))
  const assigned: number[] = []
  for (const pref of preferred) {
    let chosen = pref
    for (let step = 0; step < 180; step++) {
      const delta = Math.ceil(step / 2) * 3 * (step % 2 === 0 ? 1 : -1)
      const hue = (pref + delta + 360) % 360
      if (assigned.every((used) => hueDist(used, hue) >= minGap)) {
        chosen = hue
        break
      }
    }
    assigned.push(chosen)
  }
  return assigned
}

export function fallbackQrInk(pet: Pet): QrInk {
  return colorsFromHue(hueFromId(pet.id))
}

export async function qrInkForPet(pet: Pet): Promise<QrInk> {
  return colorsFromHue((await sampleCoverHue(pet)) ?? hueFromId(pet.id))
}

export async function qrInkForPets(pets: Pet[]): Promise<Map<string, QrInk>> {
  const preferred = await Promise.all(
    pets.map(async (pet) => (await sampleCoverHue(pet)) ?? hueFromId(pet.id)),
  )
  const hues = spreadHues(preferred)
  const map = new Map<string, QrInk>()
  pets.forEach((pet, index) => {
    map.set(pet.id, colorsFromHue(hues[index] ?? hueFromId(pet.id)))
  })
  return map
}
