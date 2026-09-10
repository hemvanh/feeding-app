import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  addDays,
  formatISO,
  monthLabel,
  parseISO,
  shortMonthLabel,
  startOfWeek,
  todayISO,
  weekdayLabels,
} from '../utils/dates'
import { cycleColor, type FeedingCycle } from '../utils/schedule'

type MiniCalendarProps = {
  cycles: FeedingCycle[]
  nextDueDate: string | null
  selectedDate?: string
  onSelectDate?: (iso: string) => void
  compactWeeks?: boolean
}

function CalendarChevron({ dir }: { dir: 'prev' | 'next' }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        d={dir === 'prev' ? 'M14.5 6 8.5 12l6 6' : 'M9.5 6l6 6-6 6'}
      />
    </svg>
  )
}

export function MiniCalendar({
  cycles,
  nextDueDate,
  selectedDate,
  onSelectDate,
  compactWeeks = false,
}: MiniCalendarProps) {
  const today = todayISO()
  const lastFedDate = cycles.at(-1)?.fedDate ?? null
  const initial = parseISO(selectedDate ?? nextDueDate ?? lastFedDate ?? today)
  const [cursor, setCursor] = useState(() => ({
    year: initial.getFullYear(),
    month: initial.getMonth(),
  }))
  const [weekStart, setWeekStart] = useState(() => startOfWeek(today))

  useEffect(() => {
    if (!selectedDate) return
    const date = parseISO(selectedDate)
    setCursor({ year: date.getFullYear(), month: date.getMonth() })
    setWeekStart(startOfWeek(selectedDate))
  }, [selectedDate])

  const monthCells = useMemo(() => {
    const first = new Date(cursor.year, cursor.month, 1)
    const startWeekday = first.getDay()
    const daysInMonth = new Date(cursor.year, cursor.month + 1, 0).getDate()
    const leading = Array.from({ length: startWeekday }, () => null)
    const monthDays = Array.from({ length: daysInMonth }, (_, i) =>
      formatISO(new Date(cursor.year, cursor.month, i + 1)),
    )
    return [...leading, ...monthDays]
  }, [cursor])

  const weekCells = useMemo(
    () => Array.from({ length: 14 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  )

  const weekMonthText = useMemo(() => {
    const start = parseISO(weekStart)
    const end = parseISO(addDays(weekStart, 13))
    const startMonth = shortMonthLabel(start.getFullYear(), start.getMonth())
    const endMonth = shortMonthLabel(end.getFullYear(), end.getMonth())
    const month = startMonth === endMonth ? startMonth : `${startMonth}–${endMonth}`
    const year = start.getFullYear() === end.getFullYear() ? start.getFullYear() : `${start.getFullYear()}/${String(end.getFullYear()).slice(-2)}`
    return { month, year: String(year) }
  }, [weekStart])

  function shiftMonth(delta: number) {
    const date = new Date(cursor.year, cursor.month + delta, 1)
    setCursor({ year: date.getFullYear(), month: date.getMonth() })
  }

  function renderDay(iso: string | null, key: string): ReactNode {
    if (!iso) return <div key={key} />
    const tint = cycleColor(iso, cycles, today)
    const isToday = iso === today
    const isFed = cycles.some((cycle) => cycle.fedDate === iso)
    const isDue = iso === nextDueDate
    const isSelected = iso === selectedDate
    const classes = [
      'calendar-cell',
      isToday ? 'is-today' : '',
      isFed ? 'is-fed' : '',
      isDue ? 'is-due' : '',
      isSelected ? 'is-selected' : '',
      tint ? 'has-cycle' : '',
      tint?.washed ? 'is-preview' : '',
    ]
      .filter(Boolean)
      .join(' ')

    const title = isFed
      ? 'Fed'
      : isDue
        ? 'Next feeding'
        : tint?.washed
          ? 'Upcoming cycle'
          : tint
            ? 'Cycle progress'
            : undefined

    const style = tint
      ? tint.washed
        ? { background: tint.color }
        : { background: tint.color, color: '#fff' }
      : undefined

    const day = parseISO(iso).getDate()
    const inner = (
      <>
        {isToday ? (
          <svg className="today-train" aria-hidden="true">
            <rect
              x="1.5"
              y="1.5"
              width="calc(100% - 3px)"
              height="calc(100% - 3px)"
              rx="8.5"
              ry="8.5"
              pathLength="100"
            />
          </svg>
        ) : null}
        <span className="day-num">{day}</span>
      </>
    )

    if (onSelectDate) {
      return (
        <button
          key={key}
          type="button"
          className={classes}
          style={style}
          title={title}
          onClick={() => onSelectDate(iso)}
        >
          {inner}
        </button>
      )
    }

    return (
      <div key={key} className={classes} style={style} title={title}>
        {inner}
      </div>
    )
  }

  if (compactWeeks) {
    return (
      <div className="calendar is-weeks">
        <div className="calendar-nav">
          <button type="button" className="icon-btn" onClick={() => setWeekStart(addDays(weekStart, -7))} aria-label="Previous week">
            <CalendarChevron dir="prev" />
          </button>
          <span className="calendar-nav-month">
            <span>{weekMonthText.month}</span>
            <span>{weekMonthText.year}</span>
          </span>
          <button type="button" className="icon-btn" onClick={() => setWeekStart(addDays(weekStart, 7))} aria-label="Next week">
            <CalendarChevron dir="next" />
          </button>
        </div>
        <div className="calendar-grid">
          {weekdayLabels().map((label, i) => (
            <div key={`${label}-${i}`} className="calendar-dow">
              {label}
            </div>
          ))}
          {weekCells.map((iso) => renderDay(iso, iso))}
        </div>
        <div className="calendar-legend">
          <span>
            <i className="swatch fed" /> Fed
          </span>
          <span className="legend-gradient" aria-hidden />
          <span>
            <i className="swatch due" /> Next feeding
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="calendar">
      <div className="calendar-nav">
        <button type="button" className="icon-btn" onClick={() => shiftMonth(-1)} aria-label="Previous month">
          <CalendarChevron dir="prev" />
        </button>
        <span>{monthLabel(cursor.year, cursor.month)}</span>
        <button type="button" className="icon-btn" onClick={() => shiftMonth(1)} aria-label="Next month">
          <CalendarChevron dir="next" />
        </button>
      </div>
      <div className="calendar-grid">
        {weekdayLabels().map((label, i) => (
          <div key={`${label}-${i}`} className="calendar-dow">
            {label}
          </div>
        ))}
        {monthCells.map((iso, i) => renderDay(iso, iso ?? `empty-${i}`))}
      </div>
      <div className="calendar-legend">
        <span>
          <i className="swatch fed" /> Fed
        </span>
        <span className="legend-gradient" aria-hidden />
        <span>
          <i className="swatch due" /> Next feeding
        </span>
      </div>
      {onSelectDate ? (
        <div className="calendar-legend marks">
          <span>
            <i className="mark today" /> Today
          </span>
          <span>
            <i className="mark selected" /> Selected
          </span>
        </div>
      ) : null}
      {onSelectDate ? (
        <p className="calendar-hint">Tap any day to set the feeding date, including older days you forgot to log.</p>
      ) : null}
    </div>
  )
}
