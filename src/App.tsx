import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { CoverPhoto, CoverThumb } from './components/CoverPhoto'
import { ConfirmDialog } from './components/ConfirmDialog'
import { ExtendForm, FeedingForm } from './components/FeedingForm'
import { MiniCalendar } from './components/MiniCalendar'
import { PetForm } from './components/PetForm'
import { SyncBar } from './components/SyncBar'
import { db, newId } from './db'
import { deleteGitHubFile, isGitHubConnected } from './github'
import { useAllFeedings, useFeedings, usePet, usePets } from './hooks/useDb'
import type { FeedingEvent, FeedingOutcome, Pet } from './types'
import { coverPhotoPath } from './utils/coverPhoto'
import { formatPretty, todayISO } from './utils/dates'
import { computeSchedule, dueLabel, dueStatus, buildCycles, wasFedToday } from './utils/schedule'

type Route =
  | { name: 'home' }
  | { name: 'new' }
  | { name: 'pet'; id: string }
  | { name: 'edit'; id: string; back: string }

function parseHash(): Route {
  const hash = window.location.hash.replace(/^#/, '') || '/'
  if (hash === '/new') return { name: 'new' }
  const edit = hash.match(/^\/pet\/([^/?]+)\/edit(?:\?(.*))?$/)
  if (edit) {
    const fromHome = new URLSearchParams(edit[2] ?? '').get('from') === 'home'
    return { name: 'edit', id: decodeURIComponent(edit[1]), back: fromHome ? '/' : `/pet/${decodeURIComponent(edit[1])}` }
  }
  const pet = hash.match(/^\/pet\/([^/]+)$/)
  if (pet) return { name: 'pet', id: decodeURIComponent(pet[1]) }
  return { name: 'home' }
}

function go(path: string) {
  window.location.hash = path
}

async function deletePetAndCover(pet: Pet) {
  if (isGitHubConnected() && pet.coverAt) {
    try {
      await deleteGitHubFile(coverPhotoPath(pet.id), `Remove cover photo for ${pet.name}`)
    } catch {
      /* still delete the pet if the photo file is already gone */
    }
  }
  await db.feedings.where('petId').equals(pet.id).delete()
  await db.pets.delete(pet.id)
  go('/')
}

function outcomeLabel(outcome: FeedingOutcome): string {
  if (outcome === 'fed') return 'Ate'
  if (outcome === 'refused') return 'Refused'
  if (outcome === 'regurgitated') return 'Regurgitated'
  return 'Extended'
}

function AppShell({
  title,
  children,
  back,
}: {
  title?: string
  children: ReactNode
  back?: string
}) {
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
          <span className="spacer" />
        ) : (
          <button type="button" className="primary-btn compact" onClick={() => go('/new')}>
            New pet
          </button>
        )}
      </header>
      <SyncBar />
      <main>{children}</main>
    </div>
  )
}

function HomePage() {
  const pets = usePets()
  const events = useAllFeedings()
  const [filter, setFilter] = useState('')

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

  return (
    <AppShell>
      <label className="search-field">
        <span className="sr-only">Search pets</span>
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Search name, species, morph"
        />
      </label>
      {pets === undefined || events === undefined ? (
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
          {cards.map(({ pet, schedule, status, fedToday, cycles }) => (
            <article key={pet.id} className={`pet-card status-${fedToday ? 'fed-today' : status}`}>
              <div className="pet-card-head">
                <div className="cover-thumb-wrap">
                  <CoverThumb pet={pet} />
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
                  <h2>{pet.name}</h2>
                  <span className={`badge ${fedToday ? 'fed-today' : status}`}>
                    {fedToday ? 'Fed today' : dueLabel(schedule.nextDueDate)}
                  </span>
                  <p className="pet-species">{pet.species}</p>
                  <p className="pet-morphs">
                    {pet.morphs.length ? pet.morphs.join(' / ') : '\u00a0'}
                  </p>
                </div>
              </div>
              <MiniCalendar cycles={cycles} nextDueDate={schedule.nextDueDate} />
              <div className="pet-card-actions">
                <button type="button" className="primary-btn compact" onClick={() => go(`/pet/${pet.id}`)}>
                  Record feeding
                </button>
                <span className="muted small">Every {pet.feedingPeriodDays} days</span>
              </div>
            </article>
          ))}
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
            go(`/pet/${pet.id}`)
          }}
        />
      </section>
    </AppShell>
  )
}

function EditPetPage({ id, back }: { id: string; back: string }) {
  const { pet, loaded } = usePet(id)
  const [confirmDelete, setConfirmDelete] = useState(false)
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
        <CoverPhoto pet={pet} />
        <PetForm
          initial={pet}
          submitLabel="Save changes"
          confirmSave
          onSubmit={async (data) => {
            await db.pets.update(pet.id, data)
            go(back)
          }}
        />
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
  }) {
    const event: FeedingEvent = {
      id: newId(),
      petId: current.id,
      date: data.date,
      note: data.note,
      outcome: data.outcome,
      extensionDays: data.extensionDays,
      createdAt: new Date().toISOString(),
    }
    await db.feedings.add(event)
  }

  return (
    <AppShell title={pet.name} back="/">
      <section className="panel pet-hero">
        <CoverPhoto pet={pet} editable={false} />
        <p className="muted">
          {pet.species}
          {pet.morphs.length ? ` · ${pet.morphs.join(' / ')}` : ''}
        </p>
        <span className={`badge ${status}`}>{dueLabel(schedule.nextDueDate)}</span>
        <p>
          Feeding period: every <strong>{pet.feedingPeriodDays}</strong> days
          {schedule.lastFedDate ? ` · Last ate ${formatPretty(schedule.lastFedDate)}` : ''}
          {schedule.nextDueDate ? ` · Next ${formatPretty(schedule.nextDueDate)}` : ''}
        </p>
      </section>

      <section className="panel">
        <MiniCalendar
          cycles={buildCycles(pet, events)}
          nextDueDate={schedule.nextDueDate}
          selectedDate={feedDate}
          onSelectDate={(iso) => {
            setFeedDate(iso)
            setTab('feed')
          }}
        />
      </section>

      <section className="panel">
        <div className="tabs">
          <button type="button" className={tab === 'feed' ? 'on' : ''} onClick={() => setTab('feed')}>
            Record feeding
          </button>
          <button type="button" className={tab === 'extend' ? 'on' : ''} onClick={() => setTab('extend')}>
            Extend cycle
          </button>
        </div>
        {tab === 'feed' ? (
          <FeedingForm
            date={feedDate}
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
        <h2>History</h2>
        {events.length === 0 ? (
          <p className="muted">No feedings recorded yet. Tap a calendar day to pick the date.</p>
        ) : (
          <ul className="history">
            {events.map((event) => (
              <li key={event.id}>
                <div>
                  <strong>{formatPretty(event.date)}</strong>
                  <span className={`pill ${event.outcome}`}>{outcomeLabel(event.outcome)}</span>
                </div>
                {event.extensionDays > 0 ? (
                  <p className="muted">
                    Extended by {event.extensionDays} day{event.extensionDays === 1 ? '' : 's'}
                  </p>
                ) : null}
                {event.note ? <p>{event.note}</p> : null}
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

export default function App() {
  const [route, setRoute] = useState<Route>(parseHash)

  useEffect(() => {
    const onHash = () => setRoute(parseHash())
    window.addEventListener('hashchange', onHash)
    if (!window.location.hash) window.location.hash = '/'
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  if (route.name === 'new') return <NewPetPage />
  if (route.name === 'edit') return <EditPetPage id={route.id} back={route.back} />
  if (route.name === 'pet') return <PetPage id={route.id} />
  return <HomePage />
}
