import { liveQuery } from 'dexie'
import { useEffect, useState } from 'react'
import { db } from '../db'
import type { FeedingEvent, Pet } from '../types'

export function usePets(): Pet[] | undefined {
  const [pets, setPets] = useState<Pet[] | undefined>(undefined)

  useEffect(() => {
    const sub = liveQuery(() =>
      db.pets.orderBy('createdAt').toArray(),
    ).subscribe({
      next: setPets,
      error: console.error,
    })
    return () => sub.unsubscribe()
  }, [])

  return pets
}

export function usePet(id: string | undefined): { pet: Pet | undefined; loaded: boolean } {
  const [pet, setPet] = useState<Pet | undefined>()
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!id) {
      setPet(undefined)
      setLoaded(true)
      return
    }
    setLoaded(false)
    const sub = liveQuery(() => db.pets.get(id)).subscribe({
      next: (row) => {
        setPet(row)
        setLoaded(true)
      },
      error: console.error,
    })
    return () => sub.unsubscribe()
  }, [id])

  return { pet, loaded }
}

export function useFeedings(petId: string | undefined): FeedingEvent[] {
  const [events, setEvents] = useState<FeedingEvent[]>([])

  useEffect(() => {
    if (!petId) {
      setEvents([])
      return
    }
    const sub = liveQuery(() =>
      db.feedings.where('petId').equals(petId).sortBy('date'),
    ).subscribe({
      next: (rows) =>
        setEvents(
          [...rows].sort((a, b) => {
            if (a.date !== b.date) return b.date.localeCompare(a.date)
            return b.createdAt.localeCompare(a.createdAt)
          }),
        ),
      error: console.error,
    })
    return () => sub.unsubscribe()
  }, [petId])

  return events
}

export function useAllFeedings(): FeedingEvent[] | undefined {
  const [events, setEvents] = useState<FeedingEvent[] | undefined>(undefined)

  useEffect(() => {
    const sub = liveQuery(() => db.feedings.toArray()).subscribe({
      next: setEvents,
      error: console.error,
    })
    return () => sub.unsubscribe()
  }, [])

  return events
}
