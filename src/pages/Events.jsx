import { EventCard, EventCardSkeleton } from '../components/events/EventCard.jsx'
import { Filters, FILTER_SPEC } from '../components/events/Filters.jsx'
import { Button } from '../components/ui/Button.jsx'
import { EmptyState, ErrorState, LoadingNote } from '../components/ui/States.jsx'
import { useAsync } from '../hooks/useAsync.js'
import { useDocumentTitle } from '../hooks/useDocumentTitle.js'
import { useUrlFilters } from '../hooks/useUrlFilters.js'
import { getEvents } from '../lib/db.js'

export default function Events() {
  useDocumentTitle()
  const { filters, setFilter, clearAll, activeCount } = useUrlFilters(FILTER_SPEC)
  // Re-fetch whenever a filter changes; useAsync cancels the older request.
  const key = JSON.stringify(filters)
  const events = useAsync((signal) => getEvents(filters, { signal }), [key])

  return (
    <>
      <section className="lace relative -mx-4 -mt-6 mb-6 overflow-hidden px-4 pt-10 pb-8 [--lace:var(--color-gold)] sm:pt-14">
        <div className="mx-auto max-w-6xl">
          <p className="text-sm font-bold tracking-widest text-gele-ink uppercase">You’re invited</p>
          <h1 className="mt-2 max-w-2xl font-display text-4xl leading-tight font-semibold sm:text-5xl">
            Owambes, meetups and <em className="text-gele-ink">nights out</em>, across Naija.
          </h1>
          <p className="mt-3 max-w-xl text-lg text-ink-soft">Book your place in a minute. Organisers: collect aso-ebi sizes and guest details without a single spreadsheet.</p>
        </div>
      </section>

      <Filters filters={filters} setFilter={setFilter} clearAll={clearAll} activeCount={activeCount} />

      <h2 className="sr-only">Events</h2>
      {/* Announced politely after each search, so screen-reader users know the list changed. */}
      <p role="status" className="mt-6 mb-3 text-sm font-bold text-ink-soft">
        {events.status === 'success' && (events.data.length === 1 ? '1 event' : `${events.data.length} events`)}
      </p>

      {events.status === 'loading' && !events.data && (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <LoadingNote>Loading events…</LoadingNote>
          {Array.from({ length: 6 }, (_, i) => (
            <EventCardSkeleton key={i} />
          ))}
        </div>
      )}

      {events.status === 'error' && <ErrorState error={events.error} onRetry={events.retry} title="We couldn’t load events" />}

      {events.data && events.status !== 'error' && (
        <>
          {events.data.length === 0 ? (
            <EmptyState
              icon="search"
              title={activeCount ? 'No events match' : 'No upcoming events yet'}
              action={activeCount ? <Button onClick={clearAll}>Clear search and filters</Button> : null}
            >
              {activeCount ? <p>Try another city or date, or fewer filters.</p> : <p>Check back soon, or organise one yourself.</p>}
            </EmptyState>
          ) : (
            <ul className={`grid gap-5 sm:grid-cols-2 lg:grid-cols-3 ${events.status === 'loading' ? 'opacity-60' : ''}`} aria-busy={events.status === 'loading'}>
              {events.data.map((e) => (
                <li key={e.id}>
                  <EventCard event={e} />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </>
  )
}
