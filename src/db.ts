import Dexie, { type EntityTable } from 'dexie'
import type { FeedingEvent, Pet } from './types'

class FeedingDB extends Dexie {
  pets!: EntityTable<Pet, 'id'>
  feedings!: EntityTable<FeedingEvent, 'id'>

  constructor() {
    super('reptile-feeding-db')
    this.version(1).stores({
      pets: 'id, name, species, createdAt',
      feedings: 'id, petId, date, createdAt, [petId+date]',
    })
  }
}

export const db = new FeedingDB()

export function newId(): string {
  return crypto.randomUUID()
}
