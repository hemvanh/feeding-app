import { useEffect, useMemo, useState } from 'react'
import {
  formatISO,
  monthLabel,
  parseISO,
  todayISO,
  weekdayLabels,
} from '../utils/dates'
import { cycleColor, type FeedingCycle } from '../utils/schedule'

type MiniCalendarProps = {
  cycles: FeedingCycle[]
  nextDueDate: string | null
  selectedDate?: string
  onSelectDate?: (iso: string) => void
}

export function MiniCalendar({
  cycles,
  nextDueDate,
  selectedDate,
  onSelectDate,
}: MiniCalendarProps) {
  const today = todayISO()
  const lastFedDate = cycles.at(-1)?.fedDate ?? null
  const initial = parseISO(selectedDate ?? nextDueDate ?? lastFedDate ?? today)
  const [cursor, setCursor] = useState(() => ({
    year: initial.getFullYear(),
    month: initial.getMonth(),
  }))

  useEffect(() => {
    if (!selectedDate) return
    const date = parseISO(selectedDate)
    setCursor({ year: date.getFullYear(), month: date.getMonth() })
  }, [selectedDate])

  const cells = useMemo(() => {
    const first = new Date(cursor.year, cursor.month, 1)
    const startWeekday = first.getDay()
    const daysInMonth = new Date(cursor.year, cursor.month + 1, 0).getDate()
    const leading = Array.from({ length: startWeekday }, () => null)
    const monthDays = Array.from({ length: daysInMonth }, (_, i) =>
      formatISO(new Date(cursor.year, cursor.month, i + 1)),
    )
    return [...leading, ...monthDays]
  }, [cursor])

  function shift(delta: number) {
    const date = new Date(cursor.year, cursor.month + delta, 1)
    setCursor({ year: date.getFullYear(), month: date.getMonth() })
  }

  return (
    <div className="calendar">
      <div className="calendar-nav">
        <button type="button" className="icon-btn" onClick={() => shift(-1)} aria-label="Previous month">
          ‹
        </button>
        <span>{monthLabel(cursor.year, cursor.month)}</span>
        <button type="button" className="icon-btn" onClick={() => shift(1)} aria-label="Next month">
          ›
        </button>
      </div>
      <div className="calendar-grid">
        {weekdayLabels().map((label, i) => (
          <div key={`${label}-${i}`} className="calendar-dow">
            {label}
          </div>
        ))}
        {cells.map((iso, i) => {
          if (!iso) return <div key={`empty-${i}`} />
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

          if (onSelectDate) {
            return (
              <button
                key={iso}
                type="button"
                className={classes}
                style={style}
                title={title}
                onClick={() => onSelectDate(iso)}
              >
                {parseISO(iso).getDate()}
              </button>
            )
          }

          return (
            <div
              key={iso}
              className={classes}
              style={style}
              title={title}
            >
              {parseISO(iso).getDate()}
            </div>
          )
        })}
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
