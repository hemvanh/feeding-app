export const SPECIES = [
  'Ball Python',
  'King Snake',
  'Milk Snake',
  'Corn Snake',
  'Hognose Snake',
  'Reticulated Python',
  'Burmese Python',
  'Tegu',
  'Iguana',
  'Pacman Frog',
  'Bull Frog',
  'Carp Fish',
  'ComxFlo Snapping',
] as const

export type Species = (typeof SPECIES)[number]

export function isPresetSpecies(value: string): value is Species {
  return (SPECIES as readonly string[]).includes(value)
}

export const FEEDING_OUTCOMES = [
  'fed',
  'water-changed',
  'refused',
  'regurgitated',
  'extended',
] as const

export type FeedingOutcome = (typeof FEEDING_OUTCOMES)[number]

export function isSuccessfulOutcome(outcome: FeedingOutcome): boolean {
  return outcome === 'fed' || outcome === 'water-changed'
}

export function outcomeLabel(outcome: FeedingOutcome): string {
  if (outcome === 'fed') return 'Ate'
  if (outcome === 'water-changed') return 'W. Changed'
  if (outcome === 'refused') return 'Refused'
  if (outcome === 'regurgitated') return 'Regurg.'
  return 'Extended'
}

export const RESULT_TAGS = [
  { outcome: 'fed', label: 'Ate' },
  { outcome: 'water-changed', label: 'W. Changed' },
  { outcome: 'refused', label: 'Refused' },
  { outcome: 'regurgitated', label: 'Regurg.' },
] as const

const RESULT_TAG_ALIASES: Record<string, FeedingOutcome> = {
  ate: 'fed',
  refused: 'refused',
  regurgitated: 'regurgitated',
  'regurg.': 'regurgitated',
  'water changed': 'water-changed',
  'w. changed': 'water-changed',
}

export function resultTagOutcome(label: string): FeedingOutcome | null {
  return RESULT_TAG_ALIASES[label.trim().toLowerCase()] ?? null
}

export const MOLT_TAG = 'Molt/Shed'

export function isMoltTag(label: string): boolean {
  const key = label.trim().toLowerCase()
  return key === 'molt/shed' || key === 'molt' || key === 'shed'
}

export function tagPillClass(label: string): string {
  return resultTagOutcome(label) ?? (isMoltTag(label) ? 'molt' : 'custom')
}

export function outcomeFromResultTags(labels: string[], extending = false): FeedingOutcome {
  const selected = new Set(labels.map((label) => resultTagOutcome(label)).filter((outcome) => outcome !== null))
  if (selected.has('regurgitated')) return 'regurgitated'
  if (selected.has('refused')) return 'refused'
  if (selected.has('water-changed')) return 'water-changed'
  if (selected.has('fed')) return 'fed'
  if (extending || labels.some(isMoltTag)) return 'extended'
  return 'fed'
}

export const FEEDER_TYPES = ['Mouse', 'Rat', 'Chicken', 'Water Change'] as const

export type FeederTypePreset = (typeof FEEDER_TYPES)[number]

export function isWaterChange(type: string | undefined): boolean {
  return (type ?? '').trim().toLowerCase() === 'water change'
}

export function feederAmountUnit(type: string | undefined): 'L' | 'g' {
  return isWaterChange(type) ? 'L' : 'g'
}

export const PET_SEXES = ['male', 'female', 'unsexed'] as const

export type PetSex = (typeof PET_SEXES)[number]

export function petSex(value: PetSex | undefined): PetSex {
  return value === 'male' || value === 'female' ? value : 'unsexed'
}

export function petSexLabel(value: PetSex | undefined): string {
  const sex = petSex(value)
  if (sex === 'male') return 'Male'
  if (sex === 'female') return 'Female'
  return 'Unsexed'
}

export type Weighing = {
  id: string
  date: string
  grams: number
  createdAt: string
}

export type Pet = {
  id: string
  name: string
  species: string
  morphs: string[]
  sex?: PetSex
  feedingPeriodDays: number
  feederType?: string
  feederAmount?: string
  feederWeightGrams?: number
  createdAt: string
  coverAt?: string
  weighings?: Weighing[]
}

export function formatGrams(grams: number): string {
  return Math.round(grams).toLocaleString('en-US')
}

export function parseGramsInput(raw: string): number | null {
  const n = Number(raw.replace(/,/g, '').trim())
  if (!Number.isFinite(n) || n <= 0 || n > 1_000_000) return null
  return Math.round(n)
}

export function latestWeighing(weighings: Weighing[] | undefined): Weighing | null {
  if (!weighings?.length) return null
  return [...weighings].sort((a, b) => {
    if (a.date !== b.date) return b.date.localeCompare(a.date)
    return b.createdAt.localeCompare(a.createdAt)
  })[0]
}

export type FeedingEvent = {
  id: string
  petId: string
  date: string
  note: string
  outcome: FeedingOutcome
  extensionDays: number
  createdAt: string
  tags?: string[]
}

type FeederFields = Pick<Pet, 'feederType' | 'feederAmount' | 'feederWeightGrams'>

/** Older pets store a number in `feederWeightGrams`; newer ones store free text in `feederAmount`. */
export function feederAmountText(pet: FeederFields): string {
  const text = pet.feederAmount?.trim()
  if (text) return /^\d+([.,]\d+)?$/.test(text) ? `${text}${feederAmountUnit(pet.feederType)}` : text
  const grams = pet.feederWeightGrams
  return typeof grams === 'number' && grams > 0 ? `${grams}${feederAmountUnit(pet.feederType)}` : ''
}

export function feederSummary(pet: FeederFields): string {
  const type = pet.feederType?.trim() ?? ''
  const amount = feederAmountText(pet)
  return [type, amount].filter(Boolean).join(' · ')
}

export type PetSchedule = {
  lastFedDate: string | null
  nextDueDate: string | null
}

export type DataDump = {
  version: 1
  updatedAt: string
  pets: Pet[]
  feedings: FeedingEvent[]
}
