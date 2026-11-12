import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
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
import { CYCLE_MARK_ORDER, cycleColor, type CycleMark, type FeedingCycle } from '../utils/schedule'

const MARK_TITLES: Record<CycleMark, string> = {
  regurgitated: 'Regurgitated',
  refused: 'Refused',
  molt: 'Molt/Shed',
  extended: 'Extended',
  'water-changed': 'W. Changed',
  fed: 'Ate',
}

function recordLabel(cycle: FeedingCycle): string {
  return cycle.tags.length ? cycle.tags.join(', ') : MARK_TITLES[cycle.mark]
}

function MarkIcon({ mark }: { mark: CycleMark }) {
  return (
    <span className={`calendar-mark is-${mark}`} aria-hidden="true">
      {mark === 'molt' ? null : (
        <svg viewBox="0 0 12 12">
          {mark === 'refused' ? <path d="M3.5 3.5l5 5M8.5 3.5l-5 5" /> : null}
          {mark === 'regurgitated' ? <path d="M3.2 6.5a2.9 2.9 0 1 0 1-2.4M3.6 2.4v2h2" /> : null}
          {mark === 'extended' ? (
            <>
              <circle cx="6" cy="6" r="3.4" />
              <path d="M6 4.2V6l1.3.9" />
            </>
          ) : null}
          {mark === 'fed' ? <path d="M3.3 6.2l1.8 1.8 3.6-3.8" /> : null}
          {mark === 'water-changed' ? <path d="M6 2.6c1.4 1.9 2.4 3.2 2.4 4.4a2.4 2.4 0 0 1-4.8 0c0-1.2 1-2.5 2.4-4.4Z" /> : null}
        </svg>
      )}
    </span>
  )
}

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
  const [bubbleDay, setBubbleDay] = useState<string | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!bubbleDay) return
    function close(event: PointerEvent) {
      const cell = event.target instanceof Element ? event.target.closest('.calendar-cell.has-mark') : null
      if (!cell || !rootRef.current?.contains(cell)) setBubbleDay(null)
    }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [bubbleDay])

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
    const isFed = cycles.some((cycle) => cycle.fed && cycle.fedDate === iso)
    const dayCycles = cycles.filter((cycle) => cycle.fedDate === iso)
    const mark = CYCLE_MARK_ORDER.find((item) => dayCycles.some((cycle) => cycle.mark === item)) ?? null
    const records = dayCycles.map(recordLabel)
    const markTitle = records.join(' · ')
    const showBubble = mark !== null && bubbleDay === iso
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
      mark ? 'has-mark' : '',
      showBubble ? 'is-bubble' : '',
    ]
      .filter(Boolean)
      .join(' ')

    const title = mark
      ? undefined
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
        <span className="day-num">{day}</span>
        {mark ? <MarkIcon mark={mark} /> : null}
        {showBubble ? (
          <span className={`calendar-bubble is-col-${parseISO(iso).getDay()}`} role="tooltip">
            {records.map((label, index) => (
              <span key={index} className="calendar-bubble-line">
                {label}
              </span>
            ))}
          </span>
        ) : null}
      </>
    )

    function toggleBubble() {
      if (mark) setBubbleDay((current) => (current === iso ? null : iso))
    }

    if (onSelectDate) {
      return (
        <button
          key={key}
          type="button"
          className={classes}
          style={style}
          title={title}
          aria-label={mark ? `${day}: ${markTitle}` : undefined}
          onClick={() => {
            toggleBubble()
            onSelectDate(iso)
          }}
        >
          {inner}
        </button>
      )
    }

    if (mark) {
      return (
        <button
          key={key}
          type="button"
          className={classes}
          style={style}
          aria-label={`${day}: ${markTitle}`}
          aria-expanded={showBubble}
          onClick={toggleBubble}
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
      <div className="calendar is-weeks" ref={rootRef}>
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
      </div>
    )
  }

  return (
    <div className="calendar" ref={rootRef}>
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
    </div>
  )
}
