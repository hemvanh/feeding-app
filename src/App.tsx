import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { CoverPhoto, CoverThumb } from './components/CoverPhoto'
import { ConfirmDialog } from './components/ConfirmDialog'
import { PetQrCode, PrintQrSticker } from './components/PetQrCode'
import { QrScanner } from './components/QrScanner'
import { ExtendForm, FeedingForm } from './components/FeedingForm'
import { MiniCalendar } from './components/MiniCalendar'
import { PetForm } from './components/PetForm'
import { SexIcon } from './components/SexIcon'
import { WeightTracker } from './components/WeightTracker'
import { SyncBar } from './components/SyncBar'
import { db, newId } from './db'
import { deleteGitHubFile, isGitHubConnected } from './github'
import { getSyncStatus, subscribeSync } from './sync'
import { useAllFeedings, useFeedings, usePet, usePets } from './hooks/useDb'
import { FEEDER_TYPES, feederAmountUnit, feederSummary, isWaterChange, latestWeighing, formatGrams, outcomeLabel, petSexLabel, resultTagOutcome, type FeedingEvent, type FeedingOutcome, type Pet } from './types'
import { coverPhotoPath } from './utils/coverPhoto'
import { petIdFromQrText } from './utils/petQr'
import { qrInkForPets, type QrInk } from './utils/qrColors'
import { formatPretty, todayISO } from './utils/dates'
import { computeSchedule, dueLabel, dueStatus, buildCycles, wasFedToday, prepUrgency } from './utils/schedule'

type Route =
  | { name: 'home' }
  | { name: 'pending' }
  | { name: 'new' }
  | { name: 'pet'; id: string }
  | { name: 'details'; id: string }
  | { name: 'edit'; id: string; back: string }
  | { name: 'print-qrs' }

function parseHash(): Route {
  const hash = window.location.hash.replace(/^#/, '') || '/'
  if (hash === '/new') return { name: 'new' }
  if (hash === '/pending') return { name: 'pending' }
  if (hash === '/print-qrs') return { name: 'print-qrs' }
  const edit = hash.match(/^\/pet\/([^/?]+)\/edit(?:\?(.*))?$/)
  if (edit) {
    const fromHome = new URLSearchParams(edit[2] ?? '').get('from') === 'home'
    return { name: 'edit', id: decodeURIComponent(edit[1]), back: fromHome ? '/' : `/pet/${decodeURIComponent(edit[1])}` }
  }
  const details = hash.match(/^\/pet\/([^/]+)\/details$/)
  if (details) return { name: 'details', id: decodeURIComponent(details[1]) }
  const pet = hash.match(/^\/pet\/([^/]+)$/)
  if (pet) return { name: 'pet', id: decodeURIComponent(pet[1]) }
  return { name: 'home' }
}

function go(path: string) {
  window.location.hash = path
}

function routeKey(route: Route) {
  switch (route.name) {
    case 'home':
      return 'pets'
    case 'pending':
      return 'pending'
    case 'pet':
      return `pet:${route.id}`
    case 'details':
      return `details:${route.id}`
    case 'edit':
      return `edit:${route.id}`
    default:
      return route.name
  }
}

function routeDepth(key: string) {
  if (key === 'pets' || key === 'pending') return 0
  if (key.startsWith('pet:')) return 1
  return 2
}

function pageDirection(from: Route, to: Route) {
  const start = routeKey(from)
  const end = routeKey(to)
  if ((start === 'pets' && end === 'pending') || (start === 'pending' && end === 'pets')) {
    return end === 'pets' ? 'page-forward' : 'page-back'
  }
  return routeDepth(end) >= routeDepth(start) ? 'page-forward' : 'page-back'
}

async function deletePetAndCover(pet: Pet) {
  if (isGitHubConnected() && pet.coverAt) {
    try {
      await deleteGitHubFile(coverPhotoPath(pet.id, pet.coverAt), `Remove cover photo for ${pet.name}`)
    } catch {
      /* still delete the pet if the photo file is already gone */
    }
  }
  await db.feedings.where('petId').equals(pet.id).delete()
  await db.pets.delete(pet.id)
  go('/')
}

function AppShell({
  title,
  children,
  back,
  actions,
  onScan,
  onPrintQrs,
  showSync,
  homeView,
}: {
  title?: string
  children: ReactNode
  back?: string
  actions?: ReactNode
  onScan?: () => void
  onPrintQrs?: () => void
  showSync?: boolean
  homeView?: 'pets' | 'pending'
}) {
  const [, setSyncTick] = useState(0)
  const githubOk = isGitHubConnected() && getSyncStatus().connected
  const [syncOpen, setSyncOpen] = useState(() => !isGitHubConnected())
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuMounted, setMenuMounted] = useState(false)
  const [menuClosing, setMenuClosing] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => subscribeSync(() => setSyncTick((n) => n + 1)), [])
  useEffect(() => {
    setSyncOpen(!githubOk)
  }, [githubOk])
  useEffect(() => {
    if (menuOpen) {
      setMenuMounted(true)
      setMenuClosing(false)
      return
    }
    if (!menuMounted) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setMenuMounted(false)
      setMenuClosing(false)
      return
    }
    setMenuClosing(true)
    const timer = window.setTimeout(() => {
      setMenuMounted(false)
      setMenuClosing(false)
    }, 150)
    return () => window.clearTimeout(timer)
  }, [menuOpen, menuMounted])
  useEffect(() => {
    if (!menuOpen) return
    function onPointer(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false)
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  return (
    <div className="app">
      <header className="topbar">
        {back ? (
          <button type="button" className="back-btn" onClick={() => go(back)}>
            Back
          </button>
        ) : (
          <span className="brand" aria-label="Reptile Feed">
            {Array.from('Reptile Feed').map((ch, i) => (
              <span key={i} className="brand-letter" style={{ '--i': i } as CSSProperties}>
                {ch === ' ' ? '\u00a0' : ch}
              </span>
            ))}
          </span>
        )}
        {title ? <h1>{title}</h1> : <span className="topbar-center" />}
        {back ? (
          actions ?? <span className="spacer" />
        ) : (
          <div className="topbar-actions">
            <button
              type="button"
              className={`primary-btn compact scan-btn view-btn${homeView === 'pending' ? ' on' : ''}`}
              aria-label="Pending feeds"
              aria-pressed={homeView === 'pending'}
              onClick={() => {
                setMenuOpen(false)
                go('/pending')
              }}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="2" />
                <path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M12 8v4.5l2.5 1.5" />
              </svg>
            </button>
            <button
              type="button"
              className={`primary-btn compact scan-btn view-btn${homeView === 'pets' ? ' on' : ''}`}
              aria-label="All pets"
              aria-pressed={homeView === 'pets'}
              onClick={() => {
                setMenuOpen(false)
                go('/')
              }}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <rect x="3.5" y="3.5" width="7" height="7" rx="1.6" fill="none" stroke="currentColor" strokeWidth="2" />
                <rect x="13.5" y="3.5" width="7" height="7" rx="1.6" fill="none" stroke="currentColor" strokeWidth="2" />
                <rect x="3.5" y="13.5" width="7" height="7" rx="1.6" fill="none" stroke="currentColor" strokeWidth="2" />
                <rect x="13.5" y="13.5" width="7" height="7" rx="1.6" fill="none" stroke="currentColor" strokeWidth="2" />
              </svg>
            </button>
            <div className="topbar-menu" ref={menuRef}>
              <button
                type="button"
                className={`primary-btn compact scan-btn view-btn menu-btn${menuOpen ? ' is-open' : ''}`}
                aria-label="Menu"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((value) => !value)}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    d="M4 7h16M4 12h16M4 17h16"
                  />
                </svg>
              </button>
              {menuMounted ? (
                <div className={`topbar-menu-panel${menuClosing ? ' is-closing' : ''}`} role="menu">
                  {showSync ? (
                    <button
                      type="button"
                      className={`primary-btn compact scan-btn${syncOpen ? ' on' : ''}`}
                      aria-label={syncOpen ? 'Hide GitHub JSON' : 'Show GitHub JSON'}
                      aria-pressed={syncOpen}
                      onClick={() => setSyncOpen((value) => !value)}
                    >
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"
                        />
                      </svg>
                    </button>
                  ) : null}
                  {onPrintQrs ? (
                    <button
                      type="button"
                      className="primary-btn compact scan-btn"
                      aria-label="Print all pet QR codes"
                      onClick={() => {
                        setMenuOpen(false)
                        onPrintQrs()
                      }}
                    >
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M6 9V4h12v5M6 18H4a1 1 0 0 1-1-1v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6a1 1 0 0 1-1 1h-2"
                        />
                        <path fill="none" stroke="currentColor" strokeWidth="2" d="M6 14h12v6H6z" />
                      </svg>
                    </button>
                  ) : null}
                  {onScan ? (
                    <button
                      type="button"
                      className="primary-btn compact scan-btn"
                      aria-label="Scan pet QR"
                      onClick={() => {
                        setMenuOpen(false)
                        onScan()
                      }}
                    >
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M7 3H4v3M17 3h3v3M7 21H4v-3M20 18v3h-3"
                        />
                        <path fill="currentColor" d="M6 6h5v5H6V6Zm1.5 1.5v2h2v-2h-2Zm5.5-1.5h5v5h-5V6Zm1.5 1.5v2h2v-2h-2ZM6 13h5v5H6v-5Zm1.5 1.5v2h2v-2h-2ZM13 13h2v2h-2v-2Zm3 0h2v2h-2v-2Zm-3 3h2v2h-2v-2Zm3 0h2v2h-2v-2Z" />
                      </svg>
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="primary-btn compact"
                    aria-label="New pet"
                    onClick={() => {
                      setMenuOpen(false)
                      go('/new')
                    }}
                  >
                    New
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        )}
      </header>
      {showSync && syncOpen ? <SyncBar /> : null}
      <main>{children}</main>
    </div>
  )
}

function HomePage({ view }: { view: 'pets' | 'pending' }) {
  const pets = usePets()
  const events = useAllFeedings()
  const [filter, setFilter] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)
  const [scanning, setScanning] = useState(false)
  const [scanError, setScanError] = useState('')

  const cards = useMemo(() => {
    if (!pets || !events) return []
    const q = filter.trim().toLowerCase()
    return pets
      .map((pet) => {
        const petEvents = events.filter((event) => event.petId === pet.id)
        const schedule = computeSchedule(pet, petEvents)
        return {
          pet,
          schedule,
          status: dueStatus(schedule.nextDueDate),
          fedToday: wasFedToday(schedule.lastFedDate),
          cycles: buildCycles(pet, petEvents),
        }
      })
      .filter(({ pet }) => {
        if (!q) return true
        return (
          pet.name.toLowerCase().includes(q) ||
          pet.species.toLowerCase().includes(q) ||
          pet.morphs.some((morph) => morph.toLowerCase().includes(q))
        )
      })
      .sort((a, b) => {
        const rank = { overdue: 0, today: 1, upcoming: 2, none: 3 }
        if (rank[a.status] !== rank[b.status]) return rank[a.status] - rank[b.status]
        return (a.schedule.nextDueDate ?? '9999').localeCompare(b.schedule.nextDueDate ?? '9999')
      })
  }, [events, filter, pets])

  const prepGroups = useMemo(() => {
    if (!pets || !events) return []
    const urgencyRank = { 'very-late': 0, late: 1, today: 2 }
    const typeRank = (type: string) => {
      const index = FEEDER_TYPES.findIndex((item) => item.toLowerCase() === type.toLowerCase())
      if (index >= 0) return index
      if (type === 'Unspecified') return 999
      return 50
    }
    const buckets = new Map<string, {
      key: string
      label: string
      type: string
      items: { petId: string; name: string; label: string; urgency: 'today' | 'late' | 'very-late' }[]
    }>()
    for (const pet of pets) {
      const petEvents = events.filter((event) => event.petId === pet.id)
      const schedule = computeSchedule(pet, petEvents)
      if (wasFedToday(schedule.lastFedDate)) continue
      const urgency = prepUrgency(schedule.nextDueDate)
      if (!urgency) continue
      const type = pet.feederType?.trim() || 'Unspecified'
      const key = type.toLowerCase()
      const grams = typeof pet.feederWeightGrams === 'number' && pet.feederWeightGrams > 0 ? pet.feederWeightGrams : 0
      const amount = grams ? `${grams}${feederAmountUnit(type)}` : ''
      const item = {
        petId: pet.id,
        name: pet.name,
        label: amount ? `${pet.name} · ${amount}` : pet.name,
        urgency,
      }
      const current = buckets.get(key)
      if (current) current.items.push(item)
      else buckets.set(key, { key, label: type, type, items: [item] })
    }
    return [...buckets.values()]
      .map((group) => ({
        ...group,
        items: [...group.items].sort((a, b) => {
          if (urgencyRank[a.urgency] !== urgencyRank[b.urgency]) return urgencyRank[a.urgency] - urgencyRank[b.urgency]
          return a.name.localeCompare(b.name)
        }),
      }))
      .sort((a, b) => {
        const rank = typeRank(a.type) - typeRank(b.type)
        if (rank !== 0) return rank
        return a.type.localeCompare(b.type)
      })
  }, [events, pets])

  useLayoutEffect(() => {
    window.scrollTo(0, 0)
  }, [view])

  function handleQrScan(text: string) {
    const id = petIdFromQrText(text)
    if (!id) {
      setScanError('This QR is not a pet code for this app.')
      return
    }
    if (!pets?.some((pet) => pet.id === id)) {
      setScanError('No matching pet on this device. Sync first, or create the pet.')
      return
    }
    setScanning(false)
    setScanError('')
    go(`/pet/${id}`)
  }

  return (
    <AppShell
      homeView={view}
      showSync
      onScan={() => {
        setScanError('')
        setScanning(true)
      }}
      onPrintQrs={() => go('/print-qrs')}
    >
      {scanning ? (
        <QrScanner
          error={scanError}
          onClose={() => {
            setScanning(false)
            setScanError('')
          }}
          onScan={handleQrScan}
        />
      ) : null}
      {view === 'pending' ? (
        <section className="panel feeder-prep is-page" aria-label="Feeders to prepare">
          <div className="feeder-prep-body">
            <div className="feeder-prep-head">
              <h2>Prepare for overdue and due today</h2>
            </div>
            {pets === undefined || events === undefined ? (
              <p className="muted">Loading pets…</p>
            ) : prepGroups.length === 0 ? (
              <p className="muted">Nothing to thaw right now.</p>
            ) : (
              <div className="feeder-prep-groups">
                {[0, 1].map((col) => (
                  <div key={col} className="feeder-prep-col">
                    {prepGroups.filter((_, index) => index % 2 === col).map((group) => (
                      <div key={group.key} className="feeder-prep-group">
                        <h3>{group.label}</h3>
                        <div className="feeder-prep-chips">
                          {group.items.map((item) => (
                            <button
                              key={item.petId}
                              type="button"
                              className={`feeder-prep-chip ${item.urgency}`}
                              onClick={() => go(`/pet/${item.petId}`)}
                            >
                              {item.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      ) : null}
      {view === 'pets' ? (
      <label className={`search-field${filter ? ' has-clear' : ''}`}>
        <span className="sr-only">Search pets</span>
        <input
          ref={searchRef}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          onFocus={(e) => {
            const input = e.currentTarget
            input.select()
            requestAnimationFrame(() => input.select())
          }}
          onMouseUp={(e) => {
            e.preventDefault()
            e.currentTarget.select()
          }}
          placeholder="Search name, species, morph"
        />
        {filter ? (
          <button
            type="button"
            className="search-clear"
            aria-label="Clear search"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              setFilter('')
              searchRef.current?.focus()
            }}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        ) : null}
      </label>
      ) : null}
      {view === 'pending' ? null : pets === undefined || events === undefined ? (
        <section className="empty">
          <p className="muted">Loading pets…</p>
        </section>
      ) : pets.length === 0 ? (
        <section className="empty">
          <p>Add your first reptile to start tracking feeding cycles.</p>
          <button type="button" className="primary-btn" onClick={() => go('/new')}>
            Create a pet
          </button>
        </section>
      ) : (
        <div className="pet-grid">
          {cards.map(({ pet, schedule, status, fedToday, cycles }) => {
            const weight = latestWeighing(pet.weighings)
            return (
            <article id={`pet-card-${pet.id}`} key={pet.id} className={`pet-card status-${fedToday ? 'fed-today' : status}`}>
              <div className="pet-card-head">
                <div className="cover-thumb-wrap">
                  <button
                    type="button"
                    className="cover-thumb-open"
                    aria-label={`View ${pet.name}`}
                    onClick={() => go(`/pet/${pet.id}/details`)}
                  >
                    <CoverThumb pet={pet} />
                  </button>
                  <button
                    type="button"
                    className="cover-edit-btn"
                    aria-label={`Edit ${pet.name}`}
                    onClick={() => go(`/pet/${pet.id}/edit?from=home`)}
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"
                      />
                    </svg>
                  </button>
                </div>
                <div className="pet-card-titles">
                  <h2>
                    <button type="button" className="pet-name-open" onClick={() => go(`/pet/${pet.id}/details`)}>
                      {pet.name}
                    </button>
                  </h2>
                  <span className={`badge ${fedToday ? 'fed-today' : status}`}>
                    {fedToday ? 'Fed today' : dueLabel(schedule.nextDueDate)}
                  </span>
                  <p className="pet-species">
                    <SexIcon sex={pet.sex} />
                    <span>
                      {pet.species}
                      {weight ? ` · ${formatGrams(weight.grams)}g` : ''}
                    </span>
                  </p>
                  <p className="pet-morphs">
                    {pet.morphs.length ? pet.morphs.join(' / ') : '\u00a0'}
                  </p>
                </div>
              </div>
              <MiniCalendar compactWeeks cycles={cycles} nextDueDate={schedule.nextDueDate} />
              <div className="pet-card-actions">
                <button type="button" className="primary-btn compact" onClick={() => go(`/pet/${pet.id}`)}>
                  {isWaterChange(pet.feederType) ? 'Change' : 'Feed'}
                </button>
                <span className="muted small">
                  Every {pet.feedingPeriodDays} days
                  {feederSummary(pet) ? ` · ${feederSummary(pet)}` : ''}
                </span>
              </div>
            </article>
            )
          })}
        </div>
      )}
    </AppShell>
  )
}

function NewPetPage() {
  return (
    <AppShell title="New pet" back="/">
      <section className="panel">
        <PetForm
          submitLabel="Create pet"
          onSubmit={async (data) => {
            const pet: Pet = {
              id: newId(),
              ...data,
              createdAt: new Date().toISOString(),
            }
            await db.pets.add(pet)
            go(`/pet/${pet.id}/edit?from=home`)
          }}
        />
      </section>
    </AppShell>
  )
}

function EditPetPage({ id, back }: { id: string; back: string }) {
  const { pet, loaded } = usePet(id)
  const [confirmDelete, setConfirmDelete] = useState(false)
  useLayoutEffect(() => {
    window.scrollTo(0, 0)
  }, [id])
  if (!loaded) {
    return (
      <AppShell title="Pet" back={back}>
        <p className="muted">Loading…</p>
      </AppShell>
    )
  }
  if (!pet) {
    return (
      <AppShell title="Pet" back={back}>
        <p className="muted">This pet was not found.</p>
      </AppShell>
    )
  }

  return (
    <AppShell title={`Edit ${pet.name}`} back={back}>
      <section className="panel stack">
        <div className="edit-media">
          <CoverPhoto pet={pet} />
          <PetQrCode pet={pet} />
        </div>
        <PetForm
          initial={pet}
          submitLabel="Save changes"
          confirmSave
          onSubmit={async (data) => {
            await db.pets.update(pet.id, data)
            go(back)
          }}
        />
        <WeightTracker pet={pet} />
        <button type="button" className="danger-btn" onClick={() => setConfirmDelete(true)}>
          Delete pet
        </button>
      </section>
      {confirmDelete ? (
        <ConfirmDialog
          title={`Delete ${pet.name}?`}
          message="This removes the pet and every feeding record. This cannot be undone."
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => {
            setConfirmDelete(false)
            void deletePetAndCover(pet)
          }}
        />
      ) : null}
    </AppShell>
  )
}

function PetPage({ id }: { id: string }) {
  const { pet, loaded } = usePet(id)
  const events = useFeedings(id)
  const schedule = pet ? computeSchedule(pet, events) : { lastFedDate: null, nextDueDate: null }
  const status = dueStatus(schedule.nextDueDate)
  const [tab, setTab] = useState<'feed' | 'extend'>('feed')
  const [feedDate, setFeedDate] = useState(todayISO)
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)

  useLayoutEffect(() => {
    window.scrollTo(0, 0)
  }, [id])

  if (!loaded) {
    return (
      <AppShell title="Pet" back="/">
        <p className="muted">Loading…</p>
      </AppShell>
    )
  }

  if (!pet) {
    return (
      <AppShell title="Pet" back="/">
        <p className="muted">This pet was not found.</p>
      </AppShell>
    )
  }

  const current = pet

  async function saveEvent(data: {
    date: string
    note: string
    outcome: FeedingOutcome
    extensionDays: number
    tags?: string[]
  }) {
    const event: FeedingEvent = {
      id: newId(),
      petId: current.id,
      date: data.date,
      note: data.note,
      outcome: data.outcome,
      extensionDays: data.extensionDays,
      createdAt: new Date().toISOString(),
      ...(data.tags?.length ? { tags: data.tags } : {}),
    }
    await db.feedings.add(event)
  }

  return (
    <AppShell
      title={pet.name}
      back="/"
      actions={
        <div className="tabs">
          <button type="button" className={tab === 'feed' ? 'on' : ''} onClick={() => setTab('feed')}>
            Feed !
          </button>
          <button type="button" className={tab === 'extend' ? 'on' : ''} onClick={() => setTab('extend')}>
            Extend
          </button>
        </div>
      }
    >
      <section className="panel">
        {tab === 'feed' ? (
          <FeedingForm
            date={feedDate}
            defaultOutcome={isWaterChange(pet.feederType) ? 'water-changed' : 'fed'}
            onSubmit={async (data) => {
              await saveEvent(data)
              go('/')
            }}
          />
        ) : (
          <ExtendForm
            defaultDays={3}
            onSubmit={async (days, note) => {
              await saveEvent({
                date: todayISO(),
                note,
                outcome: 'extended',
                extensionDays: days,
              })
              go('/')
            }}
          />
        )}
      </section>

      <section className="panel">
        <MiniCalendar
          compactWeeks
          cycles={buildCycles(pet, events)}
          nextDueDate={schedule.nextDueDate}
          selectedDate={feedDate}
          onSelectDate={(iso) => {
            setFeedDate(iso)
            setTab('feed')
          }}
        />
      </section>

      <section className="panel pet-hero">
        <CoverPhoto pet={pet} editable={false} />
        <p className="muted">
          {pet.species}
          {pet.morphs.length ? ` · ${pet.morphs.join(' / ')}` : ''}
        </p>
        <span className={`badge ${status}`}>{dueLabel(schedule.nextDueDate)}</span>
        <p>
          Feeding period: every <strong>{pet.feedingPeriodDays}</strong> days
          {feederSummary(pet) ? ` · ${feederSummary(pet)}` : ''}
          {schedule.lastFedDate ? ` · Last ate ${formatPretty(schedule.lastFedDate)}` : ''}
          {schedule.nextDueDate ? ` · Next ${formatPretty(schedule.nextDueDate)}` : ''}
        </p>
      </section>

      <section className="panel">
        <h2>History</h2>
        {events.length === 0 ? (
          <p className="muted">No feedings recorded yet. Tap a calendar day to pick the date.</p>
        ) : (
          <ul className="history">
            {events.map((event) => (
              <li key={event.id}>
                <div>
                  <strong>{formatPretty(event.date)}</strong>
                  {(event.tags?.length ? event.tags : [outcomeLabel(event.outcome)]).map((tag) => {
                    const standard = resultTagOutcome(tag)
                    return (
                      <span key={tag} className={`pill ${standard ?? 'custom'}`}>
                        {tag}
                      </span>
                    )
                  })}
                </div>
                {event.extensionDays > 0 ? (
                  <p className="muted">
                    Extended by {event.extensionDays} day{event.extensionDays === 1 ? '' : 's'}
                  </p>
                ) : null}
                {event.tags?.length ? null : event.note ? <p>{event.note}</p> : null}
                <button
                  type="button"
                  className="text-btn"
                  onClick={() => setPendingDelete(event.id)}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
      {pendingDelete ? (
        <ConfirmDialog
          title="Delete this feeding?"
          message="This record will be removed from the history. This cannot be undone."
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => {
            const id = pendingDelete
            setPendingDelete(null)
            void db.feedings.delete(id)
          }}
        />
      ) : null}
    </AppShell>
  )
}

function PetDetailsPage({ id }: { id: string }) {
  const { pet, loaded } = usePet(id)
  const events = useFeedings(id)
  const schedule = pet ? computeSchedule(pet, events) : { lastFedDate: null, nextDueDate: null }
  const status = dueStatus(schedule.nextDueDate)
  const fedToday = wasFedToday(schedule.lastFedDate)
  const weight = pet ? latestWeighing(pet.weighings) : null

  useLayoutEffect(() => {
    window.scrollTo(0, 0)
  }, [id])

  if (!loaded) {
    return (
      <AppShell title="Pet" back="/">
        <p className="muted">Loading…</p>
      </AppShell>
    )
  }

  if (!pet) {
    return (
      <AppShell title="Pet" back="/">
        <p className="muted">This pet was not found.</p>
      </AppShell>
    )
  }

  return (
    <AppShell title={pet.name} back="/">
      <section className="panel pet-hero">
        <CoverPhoto pet={pet} editable={false} />
        <p className="pet-identity">
          <SexIcon sex={pet.sex} />
          <span>
            {petSexLabel(pet.sex)} · {pet.species}
            {pet.morphs.length ? ` · ${pet.morphs.join(' / ')}` : ''}
          </span>
        </p>
        <span className={`badge ${fedToday ? 'fed-today' : status}`}>
          {fedToday ? 'Fed today' : dueLabel(schedule.nextDueDate)}
        </span>
        <p>
          Feeding period: every <strong>{pet.feedingPeriodDays}</strong> days
          {feederSummary(pet) ? ` · ${feederSummary(pet)}` : ''}
          {weight ? ` · ${formatGrams(weight.grams)} g` : ''}
          {schedule.lastFedDate ? ` · Last ate ${formatPretty(schedule.lastFedDate)}` : ''}
          {schedule.nextDueDate ? ` · Next ${formatPretty(schedule.nextDueDate)}` : ''}
        </p>
      </section>

      <section className="panel">
        <MiniCalendar compactWeeks cycles={buildCycles(pet, events)} nextDueDate={schedule.nextDueDate} />
      </section>

      <section className="panel">
        <h2>History</h2>
        {events.length === 0 ? (
          <p className="muted">No feedings recorded yet.</p>
        ) : (
          <ul className="history">
            {events.map((event) => (
              <li key={event.id}>
                <div>
                  <strong>{formatPretty(event.date)}</strong>
                  {(event.tags?.length ? event.tags : [outcomeLabel(event.outcome)]).map((tag) => {
                    const standard = resultTagOutcome(tag)
                    return (
                      <span key={tag} className={`pill ${standard ?? 'custom'}`}>
                        {tag}
                      </span>
                    )
                  })}
                </div>
                {event.extensionDays > 0 ? (
                  <p className="muted">
                    Extended by {event.extensionDays} day{event.extensionDays === 1 ? '' : 's'}
                  </p>
                ) : null}
                {event.tags?.length ? null : event.note ? <p>{event.note}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel">
        <WeightTracker pet={pet} readOnly />
      </section>
    </AppShell>
  )
}

function PrintQrPage() {
  const pets = usePets()
  const stickers = useMemo(() => {
    if (!pets) return []
    return [...pets].sort((a, b) => {
      const species = a.species.localeCompare(b.species)
      if (species !== 0) return species
      const morphs = (a.morphs.join(' / ') || '—').localeCompare(b.morphs.join(' / ') || '—')
      if (morphs !== 0) return morphs
      return a.name.localeCompare(b.name)
    })
  }, [pets])
  const stickerKey = stickers.map((pet) => `${pet.id}:${pet.coverAt ?? ''}`).join('|')
  const [inkById, setInkById] = useState<Map<string, QrInk>>(new Map())

  useEffect(() => {
    if (stickers.length === 0) return
    let cancelled = false
    void qrInkForPets(stickers).then((palette) => {
      if (!cancelled) setInkById(palette)
    })
    return () => {
      cancelled = true
    }
  }, [stickerKey])

  useEffect(() => {
    document.body.classList.add('is-qr-print')
    return () => document.body.classList.remove('is-qr-print')
  }, [])

  return (
    <AppShell
      back="/"
      actions={
        <button type="button" className="primary-btn compact" onClick={() => window.print()}>
          Print
        </button>
      }
    >
      {pets === undefined ? (
        <p className="muted">Loading pets…</p>
      ) : stickers.length === 0 ? (
        <p className="muted">No pets to print.</p>
      ) : (
        <section className="qr-print-sheet">
          {stickers.map((pet) => (
            <PrintQrSticker key={pet.id} pet={pet} ink={inkById.get(pet.id)} />
          ))}
        </section>
      )}
    </AppShell>
  )
}

function RouteView({ route }: { route: Route }) {
  if (route.name === 'print-qrs') return <PrintQrPage />
  if (route.name === 'new') return <NewPetPage />
  if (route.name === 'home' || route.name === 'pending') {
    return <HomePage view={route.name === 'pending' ? 'pending' : 'pets'} />
  }
  if (route.name === 'edit') return <EditPetPage id={route.id} back={route.back} />
  if (route.name === 'details') return <PetDetailsPage id={route.id} />
  return <PetPage id={route.id} />
}

export default function App() {
  const [route, setRoute] = useState<Route>(parseHash)
  const [shown, setShown] = useState<Route>(parseHash)
  const [motion, setMotion] = useState<'in' | 'out' | 'idle'>('in')
  const [direction, setDirection] = useState<'page-forward' | 'page-back'>('page-forward')
  const swapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onHash = () => setRoute(parseHash())
    window.addEventListener('hashchange', onHash)
    if (!window.location.hash) window.location.hash = '/'
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  useEffect(() => {
    if (routeKey(route) === routeKey(shown)) return
    const nextDirection = pageDirection(shown, route)
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setDirection(nextDirection)
      setShown(route)
      setMotion('idle')
      return
    }
    setDirection(nextDirection)
    setMotion('out')
    const timer = window.setTimeout(() => {
      setShown(route)
      setMotion('in')
    }, 130)
    return () => window.clearTimeout(timer)
  }, [route, shown])

  useLayoutEffect(() => {
    const el = swapRef.current
    if (!el || motion === 'idle') return
    el.style.animation = 'none'
    void el.offsetWidth
    el.style.animation = ''
  }, [motion, direction, shown])

  return (
    <div ref={swapRef} className={`page-swap is-${motion} ${direction}`}>
      <RouteView route={shown} />
    </div>
  )
}
