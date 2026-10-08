import { useState } from 'react'
import { Link } from 'react-router-dom'
import { EventCover } from '../components/events/EventCover.jsx'
import { Badge } from '../components/ui/Badge.jsx'
import { Button, buttonClass } from '../components/ui/Button.jsx'
import { ConfirmDialog } from '../components/ui/Dialog.jsx'
import { Icon } from '../components/ui/Icon.jsx'
import { EmptyState, ErrorState, LoadingNote, Skeleton } from '../components/ui/States.jsx'
import { useAsync } from '../hooks/useAsync.js'
import { useDocumentTitle } from '../hooks/useDocumentTitle.js'
import { formatEventWhen } from '../lib/dates.js'
import { getOrganiserEvents, resetDemoData } from '../lib/db.js'

/*
  The organiser's home: every event (past ones too) with how full it is,
  and links to its dashboard, editor and public page.
  There are no accounts in this demo, so "your events" means every event
  in this browser.
*/
export default function OrganiseHome() {
  useDocumentTitle('Organise')
  const events = useAsync((signal) => getOrganiserEvents({ signal }), [])
  const [confirmReset, setConfirmReset] = useState(false)
  const [resetting, setResetting] = useState(false)

  async function reset() {
    setResetting(true)
    try {
      await resetDemoData()
      setConfirmReset(false)
      events.retry()
    } finally {
      setResetting(false)
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-bold tracking-widest text-gele-ink uppercase">For organisers</p>
          <h1 className="mt-1 font-display text-4xl font-semibold">Your events</h1>
          <p className="mt-1 max-w-xl text-ink-soft">
            Tickets, guest details and aso-ebi orders in one place, instead of a WhatsApp thread and three spreadsheets.
          </p>
        </div>
        <Link to="/organise/new" className={buttonClass('primary', 'lg')}>
          <Icon name="plus" className="size-5" />
          Create an event
        </Link>
      </div>

      <div className="mt-8">
        {events.status === 'error' && <ErrorState error={events.error} onRetry={events.retry} title="We couldn’t load your events" />}
        {!events.data && events.status === 'loading' && (
          <ul className="space-y-3">
            <LoadingNote>Loading your events…</LoadingNote>
            {[1, 2, 3].map((n) => (
              <Skeleton key={n} className="h-28 w-full rounded-2xl" />
            ))}
          </ul>
        )}
        {events.data && events.data.length === 0 && (
          <EmptyState
            icon="calendar"
            title="No events yet"
            action={
              <Link to="/organise/new" className={buttonClass('primary')}>
                Create your first event
              </Link>
            }
          >
            <p>Set up tickets and your own questions, and share the link.</p>
          </EmptyState>
        )}
        {events.data && events.data.length > 0 && (
          <ul className="space-y-3">
            {events.data.map((e) => {
              const capacity = e.tickets.reduce((n, t) => n + t.quantity, 0)
              const booked = e.tickets.reduce((n, t) => n + t.sold, 0)
              const percent = Math.round((booked / capacity) * 100)
              return (
                <li key={e.id} className="flex flex-col overflow-hidden rounded-2xl bg-panel ring-1 ring-line sm:flex-row">
                  <EventCover cover={e.cover} className="h-16 sm:h-auto sm:w-28 sm:shrink-0" />
                  <div className="flex flex-1 flex-col gap-3 p-4 md:flex-row md:items-center">
                    <div className="min-w-0 flex-1">
                      <h2 className="font-display text-xl leading-snug font-semibold">
                        <Link to={`/organise/${e.id}`} className="hover:underline">
                          {e.title}
                        </Link>
                      </h2>
                      <p className="text-sm text-ink-soft">
                        {formatEventWhen(e.startsAt, e.endsAt)} · {e.venue.city}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                        {e.isPast ? <Badge>Ended</Badge> : e.soldOut ? <Badge tone="danger">Sold out</Badge> : <Badge tone="teal">On sale</Badge>}
                        <span className="text-ink-soft">
                          {booked.toLocaleString('en-NG')} of {capacity.toLocaleString('en-NG')} booked · {e.bookingCount} bookings
                        </span>
                      </div>
                      {/* A real <meter>: screen readers announce it as "57% booked". */}
                      <meter min={0} max={capacity} value={booked} className="sr-only">
                        {percent}% booked
                      </meter>
                      <div aria-hidden="true" className="mt-2 h-1.5 max-w-xs overflow-hidden rounded-full bg-panel-2">
                        <div className="h-full rounded-full bg-gele" style={{ width: `${percent}%` }} />
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Link to={`/organise/${e.id}`} className={buttonClass('secondary', 'sm')}>
                        <Icon name="chart" className="size-4" />
                        Dashboard
                      </Link>
                      <Link to={`/organise/${e.id}/edit`} className={buttonClass('outline', 'sm')}>
                        <Icon name="edit" className="size-4" />
                        Edit<span className="sr-only"> {e.title}</span>
                      </Link>
                      <Link to={`/events/${e.slug}`} className={buttonClass('ghost', 'sm')}>
                        <Icon name="eye" className="size-4" />
                        View<span className="sr-only"> {e.title} as a guest</span>
                      </Link>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <div className="mt-12 rounded-2xl border border-dashed border-line-strong p-4 text-sm text-ink-soft sm:flex sm:items-center sm:justify-between sm:gap-4">
        <p>Demo data lives in this browser. Reset it to get the six sample events back and remove anything you’ve added.</p>
        <Button variant="danger" size="sm" className="mt-2 sm:mt-0" onClick={() => setConfirmReset(true)}>
          <Icon name="retry" className="size-4" />
          Reset demo data
        </Button>
      </div>

      <ConfirmDialog
        open={confirmReset}
        title="Reset all demo data?"
        tone="danger"
        confirmLabel={resetting ? 'Resetting…' : 'Reset everything'}
        cancelLabel="Cancel"
        busy={resetting}
        onConfirm={reset}
        onCancel={() => setConfirmReset(false)}
      >
        Every event and booking in this browser will be replaced by the sample data. This can’t be undone.
      </ConfirmDialog>
    </div>
  )
}
