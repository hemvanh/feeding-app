const DAY_MS = 86_400_000

export function pad(n: number): string {
  return String(n).padStart(2, '0')
}

export function formatISO(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function parseISO(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function todayISO(): string {
  return formatISO(new Date())
}

export function addDays(iso: string, days: number): string {
  const date = parseISO(iso)
  date.setDate(date.getDate() + days)
  return formatISO(date)
}

export function daysBetween(from: string, to: string): number {
  return Math.round((parseISO(to).getTime() - parseISO(from).getTime()) / DAY_MS)
}

export function startOfMonth(iso: string): Date {
  const date = parseISO(iso)
  date.setDate(1)
  return date
}

export function monthLabel(year: number, monthIndex: number): string {
  return new Date(year, monthIndex, 1).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  })
}

export function formatPretty(iso: string): string {
  return parseISO(iso).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function weekdayLabels(): string[] {
  const formatter = new Intl.DateTimeFormat(undefined, { weekday: 'narrow' })
  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(2024, 8, 1 + i)
    return formatter.format(date)
  })
}
