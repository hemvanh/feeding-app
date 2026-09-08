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
  if (outcome === 'water-changed') return 'Water Changed'
  if (outcome === 'refused') return 'Refused'
  if (outcome === 'regurgitated') return 'Regurgitated'
  return 'Extended'
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
  species: Species
  morphs: string[]
  sex?: PetSex
  feedingPeriodDays: number
  feederType?: string
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
}

export function feederSummary(pet: Pick<Pet, 'feederType' | 'feederWeightGrams'>): string {
  const type = pet.feederType?.trim() ?? ''
  const amount = pet.feederWeightGrams
  const hasAmount = typeof amount === 'number' && amount > 0
  const unit = feederAmountUnit(type)
  if (type && hasAmount) return `${type} · ${amount}${unit}`
  if (type) return type
  if (hasAmount) return `${amount}${unit}`
  return ''
}

export type FeederPrepLine = {
  type: string
  grams: number | null
  count: number
}

export function feederPrepLines(pets: Pet[]): FeederPrepLine[] {
  const buckets = new Map<string, FeederPrepLine>()
  for (const pet of pets) {
    const type = pet.feederType?.trim() || 'Unspecified'
    const grams = typeof pet.feederWeightGrams === 'number' && pet.feederWeightGrams > 0 ? pet.feederWeightGrams : null
    const key = `${type.toLowerCase()}|${grams ?? 'none'}`
    const current = buckets.get(key)
    if (current) current.count += 1
    else buckets.set(key, { type, grams, count: 1 })
  }
  const rankOf = (type: string) => {
    const index = FEEDER_TYPES.findIndex((item) => item.toLowerCase() === type.toLowerCase())
    if (index >= 0) return index
    if (type === 'Unspecified') return 999
    return 50
  }
  return [...buckets.values()].sort((a, b) => {
    const rank = rankOf(a.type) - rankOf(b.type)
    if (rank !== 0) return rank
    if (a.type !== b.type) return a.type.localeCompare(b.type)
    return (a.grams ?? 0) - (b.grams ?? 0)
  })
}

export function feederPrepLabel(line: FeederPrepLine): string {
  const unit = feederAmountUnit(line.type)
  const amount = line.grams != null ? ` ${line.grams}${unit}` : ''
  return `${line.count} × ${line.type}${amount}`
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
