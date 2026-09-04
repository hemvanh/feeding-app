import type { FeedingEvent, Pet, PetSchedule } from '../types'
import { addDays, daysBetween, todayISO } from './dates'

function orderedEvents(events: FeedingEvent[]): FeedingEvent[] {
  return [...events].sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date)
    return a.createdAt.localeCompare(b.createdAt)
  })
}

export function computeSchedule(
  pet: Pet,
  events: FeedingEvent[],
): PetSchedule {
  const ordered = orderedEvents(events)

  let lastFedDate: string | null = null
  let nextDueDate: string | null = null

  for (const event of ordered) {
    if (event.outcome === 'fed') {
      lastFedDate = event.date
      nextDueDate = addDays(event.date, pet.feedingPeriodDays)
      continue
    }

    const extra = event.extensionDays || 0
    if (extra <= 0) continue

    const base = nextDueDate && nextDueDate >= event.date ? nextDueDate : event.date
    nextDueDate = addDays(base, extra)
  }

  return { lastFedDate, nextDueDate }
}

export type FeedingCycle = {
  fedDate: string
  dueDate: string
  untilDate: string | null
}

export function buildCycles(pet: Pet, events: FeedingEvent[]): FeedingCycle[] {
  const ordered = orderedEvents(events)
  const cycles: FeedingCycle[] = []
  let current: { fedDate: string; dueDate: string } | null = null

  function closeCurrent(nextFeedDate: string | null) {
    if (!current) return
    cycles.push({
      fedDate: current.fedDate,
      dueDate: current.dueDate,
      untilDate: nextFeedDate,
    })
    current = null
  }

  for (const event of ordered) {
    if (event.outcome === 'fed') {
      closeCurrent(event.date)
      current = {
        fedDate: event.date,
        dueDate: addDays(event.date, pet.feedingPeriodDays),
      }
      continue
    }

    const extra = event.extensionDays || 0
    if (extra <= 0 || !current) continue

    const base = current.dueDate >= event.date ? current.dueDate : event.date
    current.dueDate = addDays(base, extra)
  }

  closeCurrent(null)
  return cycles
}

export type DueStatus = 'none' | 'upcoming' | 'today' | 'overdue'

export function dueStatus(nextDueDate: string | null, today = todayISO()): DueStatus {
  if (!nextDueDate) return 'none'
  const delta = daysBetween(today, nextDueDate)
  if (delta < 0) return 'overdue'
  if (delta === 0) return 'today'
  return 'upcoming'
}

export function wasFedToday(lastFedDate: string | null, today = todayISO()): boolean {
  return lastFedDate === today
}

export function dueLabel(nextDueDate: string | null, today = todayISO()): string {
  if (!nextDueDate) return 'No feeding recorded yet'
  const delta = daysBetween(today, nextDueDate)
  if (delta < 0) return `Overdue by ${Math.abs(delta)} day${Math.abs(delta) === 1 ? '' : 's'}`
  if (delta === 0) return 'Due today'
  return `Due in ${delta} day${delta === 1 ? '' : 's'}`
}

function hslForProgress(progress: number): string {
  const t = Math.min(Math.max(progress, 0), 1)
  const hue = 142 - t * 134
  const sat = 52 + t * 22
  const light = 38 - t * 6
  return `hsl(${hue} ${sat}% ${light}%)`
}

export function cycleColor(
  day: string,
  cycles: FeedingCycle[],
  today = todayISO(),
): string | null {
  let match: FeedingCycle | null = null
  for (const cycle of cycles) {
    if (day < cycle.fedDate) continue
    if (cycle.untilDate && day >= cycle.untilDate) continue
    match = cycle
  }
  if (!match) return null
  if (day > today) return null

  if (day > match.dueDate) return hslForProgress(1)

  const span = Math.max(daysBetween(match.fedDate, match.dueDate), 1)
  return hslForProgress(daysBetween(match.fedDate, day) / span)
}
