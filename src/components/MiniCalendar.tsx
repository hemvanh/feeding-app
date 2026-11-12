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

type CalendarSize = 'weeks' | 'month' | 'two-months'

function SizeIcon({ grow }: { grow: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        d={
          grow
            ? 'M14 4h6v6M20 4l-6.5 6.5M10 20H4v-6M4 20l6.5-6.5'
            : 'M20 10h-6V4M14 10l6.5-6.5M4 14h6v6M10 14l-6.5 6.5'
        }
      />
    </svg>
  )
}

function cellsForMonth(year: number, month: number): (string | null)[] {
  const leading = Array.from({ length: new Date(year, month, 1).getDay() }, () => null)
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  return [...leading, ...Array.from({ length: daysInMonth }, (_, i) => formatISO(new Date(year, month, i + 1)))]
}

type MiniCalendarProps = {
  resizable?: boolean
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
  resizable = false,
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
  const [size, setSize] = useState<CalendarSize>(compactWeeks ? 'weeks' : 'month')
  const [fade, setFade] = useState<'idle' | 'out' | 'in'>('idle')
  const fadeClass = fade === 'idle' ? '' : ` is-fade-${fade}`
  const fadeTimer = useRef<number | undefined>(undefined)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => () => window.clearTimeout(fadeTimer.current), [])

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

  const shownMonths = useMemo(() => {
    const count = size === 'two-months' ? 2 : 1
    return Array.from({ length: count }, (_, i) => {
      const date = new Date(cursor.year, cursor.month + i, 1)
      return { year: date.getFullYear(), month: date.getMonth() }
    })
  }, [cursor, size])

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

  function resize(next: CalendarSize) {
    if (fade !== 'idle') return
    setBubbleDay(null)
    setFade('out')
    fadeTimer.current = window.setTimeout(() => {
      applySize(next)
      setFade('in')
      fadeTimer.current = window.setTimeout(() => setFade('idle'), 220)
    }, 140)
  }

  function applySize(next: CalendarSize) {
    if (size === 'weeks') {
      const middle = parseISO(addDays(weekStart, 6))
      setCursor({ year: middle.getFullYear(), month: middle.getMonth() })
    } else if (next === 'weeks') {
      const anchor = [selectedDate, today].find((iso) => {
        if (!iso) return false
        const date = parseISO(iso)
        return date.getFullYear() === cursor.year && date.getMonth() === cursor.month
      })
      setWeekStart(startOfWeek(anchor ?? formatISO(new Date(cursor.year, cursor.month, 1))))
    }
    setSize(next)
  }

  function sizeButton(next: CalendarSize, grow: boolean, label: string) {
    return (
      <button key={next} type="button" className="calendar-size-btn" onClick={() => resize(next)} aria-label={label} title={label}>
        <SizeIcon grow={grow} />
      </button>
    )
  }

  function renderFooter() {
    const sizeButtons = !resizable
      ? null
      : size === 'weeks'
        ? [sizeButton('month', true, 'Show full month')]
        : size === 'month'
          ? [sizeButton('weeks', false, 'Show 2 weeks'), sizeButton('two-months', true, 'Show 2 months')]
          : [sizeButton('month', false, 'Show 1 month')]
    return (
      <>
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
        {sizeButtons ? <div className="calendar-size">{sizeButtons}</div> : null}
      </>
    )
  }

  function renderGrid(cells: (string | null)[], keyPrefix: string) {
    return (
      <div className="calendar-grid">
        {weekdayLabels().map((label, i) => (
          <div key={`${label}-${i}`} className="calendar-dow">
            {label}
          </div>
        ))}
        {cells.map((iso, i) => renderDay(iso, iso ?? `${keyPrefix}-empty-${i}`))}
      </div>
    )
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

  if (size === 'weeks') {
    return (
      <div className={`calendar is-weeks${fadeClass}`} ref={rootRef}>
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
        {renderGrid(weekCells, 'weeks')}
        {renderFooter()}
      </div>
    )
  }

  return (
    <div className={`calendar${fadeClass}`} ref={rootRef}>
      <div className="calendar-nav">
        <button type="button" className="icon-btn" onClick={() => shiftMonth(-1)} aria-label="Previous month">
          <CalendarChevron dir="prev" />
        </button>
        <span>{monthLabel(cursor.year, cursor.month)}</span>
        <button type="button" className="icon-btn" onClick={() => shiftMonth(1)} aria-label="Next month">
          <CalendarChevron dir="next" />
        </button>
      </div>
      {shownMonths.map(({ year, month }, index) => (
        <div key={`${year}-${month}`} className="calendar-month">
          {index > 0 ? <p className="calendar-month-label">{monthLabel(year, month)}</p> : null}
          {renderGrid(cellsForMonth(year, month), `${year}-${month}`)}
        </div>
      ))}
      {renderFooter()}
    </div>
  )
}
