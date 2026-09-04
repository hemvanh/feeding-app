export const SPECIES = [
  'Ball Python',
  'King Snake',
  'Milk Snake',
  'Corn Snake',
  'Hognose Snake',
  'Reticulated Python',
  'Burmese Python',
  'Pacman Frog',
  'Bull Frog',
] as const

export type Species = (typeof SPECIES)[number]

export const FEEDING_OUTCOMES = [
  'fed',
  'refused',
  'regurgitated',
  'extended',
] as const

export type FeedingOutcome = (typeof FEEDING_OUTCOMES)[number]

export type Pet = {
  id: string
  name: string
  species: Species
  morphs: string[]
  feedingPeriodDays: number
  createdAt: string
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
