import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { ConfirmDialog } from './components/ConfirmDialog'
import { ExtendForm, FeedingForm } from './components/FeedingForm'
import { MiniCalendar } from './components/MiniCalendar'
import { PetForm } from './components/PetForm'
import { SyncBar } from './components/SyncBar'
import { db, newId } from './db'
import { useAllFeedings, useFeedings, usePet, usePets } from './hooks/useDb'
import type { FeedingEvent, FeedingOutcome, Pet } from './types'
import { formatPretty, todayISO } from './utils/dates'
import { computeSchedule, dueLabel, dueStatus, buildCycles } from './utils/schedule'

type Route =
  | { name: 'home' }
  | { name: 'new' }
  | { name: 'pet'; id: string }
  | { name: 'edit'; id: string }

function parseHash(): Route {
  const hash = window.location.hash.replace(/^#/, '') || '/'
  if (hash === '/new') return { name: 'new' }
  const edit = hash.match(/^\/pet\/([^/]+)\/edit$/)
  if (edit) return { name: 'edit', id: decodeURIComponent(edit[1]) }
  const pet = hash.match(/^\/pet\/([^/]+)$/)
  if (pet) return { name: 'pet', id: decodeURIComponent(pet[1]) }
  return { name: 'home' }
}

function go(path: string) {
  window.location.hash = path
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
  title: string
  children: ReactNode
  back?: string
}) {
  return (
    <div className="app">
      <header className="topbar">
        {back ? (
          <button type="button" className="text-btn" onClick={() => go(back)}>
            Back
          </button>
        ) : (
          <span className="brand">Reptile Feed</span>
        )}
        <h1>{title}</h1>
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
    <AppShell title="Feeding calendar">
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
          {cards.map(({ pet, schedule, status, cycles }) => (
            <article key={pet.id} className={`pet-card status-${status}`}>
              <button type="button" className="pet-card-hit" onClick={() => go(`/pet/${pet.id}`)}>
                <div className="pet-card-head">
                  <div className="pet-card-titles">
                    <h2>{pet.name}</h2>
                    <p className="pet-species">{pet.species}</p>
                    <p className="pet-morphs">
                      {pet.morphs.length ? pet.morphs.join(' / ') : '\u00a0'}
                    </p>
                  </div>
                  <span className={`badge ${status}`}>{dueLabel(schedule.nextDueDate)}</span>
                </div>
              </button>
              <MiniCalendar cycles={cycles} nextDueDate={schedule.nextDueDate} />
              <div className="pet-card-actions">
                <button type="button" className="ghost-btn" onClick={() => go(`/pet/${pet.id}`)}>
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

function EditPetPage({ id }: { id: string }) {
  const { pet, loaded } = usePet(id)
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
    <AppShell title={`Edit ${pet.name}`} back={`/pet/${pet.id}`}>
      <section className="panel">
        <PetForm
          initial={pet}
          submitLabel="Save changes"
          onSubmit={async (data) => {
            await db.pets.update(pet.id, data)
            go(`/pet/${pet.id}`)
          }}
        />
      </section>
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
  const [pendingDelete, setPendingDelete] = useState<{ kind: 'pet' } | { kind: 'feeding'; id: string } | null>(
    null,
  )

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
        <div className="row-actions">
          <button type="button" className="ghost-btn" onClick={() => go(`/pet/${pet.id}/edit`)}>
            Edit pet
          </button>
          <button type="button" className="danger-btn" onClick={() => setPendingDelete({ kind: 'pet' })}>
            Delete
          </button>
        </div>
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
              setFeedDate(todayISO())
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
                  onClick={() => setPendingDelete({ kind: 'feeding', id: event.id })}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
      {pendingDelete?.kind === 'pet' ? (
        <ConfirmDialog
          title={`Delete ${pet.name}?`}
          message="This removes the pet and every feeding record. This cannot be undone."
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => {
            void (async () => {
              await db.feedings.where('petId').equals(pet.id).delete()
              await db.pets.delete(pet.id)
              go('/')
            })()
          }}
        />
      ) : null}
      {pendingDelete?.kind === 'feeding' ? (
        <ConfirmDialog
          title="Delete this feeding?"
          message="This record will be removed from the history. This cannot be undone."
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => {
            const id = pendingDelete.id
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
  if (route.name === 'edit') return <EditPetPage id={route.id} />
  if (route.name === 'pet') return <PetPage id={route.id} />
  return <HomePage />
}
