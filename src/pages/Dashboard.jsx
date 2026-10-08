import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { BookingsTable } from '../components/organise/BookingsTable.jsx'
import { AnswerSummary, CrossTab, SalesByType, StatTile } from '../components/organise/DashboardParts.jsx'
import { Button, buttonClass } from '../components/ui/Button.jsx'
import { ConfirmDialog } from '../components/ui/Dialog.jsx'
import { Icon } from '../components/ui/Icon.jsx'
import { ErrorState, LoadingNote, Skeleton } from '../components/ui/States.jsx'
import { useAsync } from '../hooks/useAsync.js'
import { useDocumentTitle } from '../hooks/useDocumentTitle.js'
import { toCsv } from '../lib/csv.js'
import { formatEventWhen, lagosDateKey } from '../lib/dates.js'
import { cancelBooking, getBookings, getEventForOrganiser, getWaitlist } from '../lib/db.js'
import { downloadFile } from '../lib/ics.js'
import { formatNaira } from '../lib/money.js'
import { formatPhoneLocal } from '../lib/phone.js'
import { answerSummary, defaultCrossTab, guestRows, salesSummary } from '../lib/stats.js'
import NotFound from './NotFound.jsx'

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <LoadingNote>Loading the dashboard…</LoadingNote>
      <Skeleton className="h-10 w-2/3" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[1, 2, 3, 4].map((n) => (
          <Skeleton key={n} className="h-24 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-40 w-full rounded-2xl" />
      <Skeleton className="h-72 w-full rounded-2xl" />
    </div>
  )
}

function Section({ title, intro, action, children }) {
  return (
    <section className="mt-10">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-semibold">{title}</h2>
          {intro && <p className="text-sm text-ink-soft">{intro}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

/*
  The event dashboard: sales, revenue, the bookings table, everyone's
  answers summarised (with a cross-tab for aso-ebi orders), the waitlist,
  and CSV export. Cancelling a booking frees its spots at once, because
  spots are always counted from confirmed bookings.
*/
export default function Dashboard() {
  const { id } = useParams()
  const location = useLocation()
  const state = useAsync(
    (signal) =>
      Promise.all([getEventForOrganiser(id, { signal }), getBookings(id, { signal }), getWaitlist(id, { signal })]).then(([event, bookings, waitlist]) => ({
        event,
        bookings,
        waitlist,
      })),
    [id],
  )
  const [cancelling, setCancelling] = useState(null)
  const [busy, setBusy] = useState(false)
  const [cancelError, setCancelError] = useState(null)
  const [message, setMessage] = useState(location.state?.saved ? `“${location.state.saved}” is saved.` : '')
  const messageRef = useRef(null)
  useDocumentTitle(state.data ? `Dashboard: ${state.data.event.title}` : 'Dashboard')

  useEffect(() => {
    if (message) messageRef.current?.focus()
  }, [message])

  if (state.status === 'error' && !state.data) {
    if (state.error?.code === 'NOT_FOUND') return <NotFound title="We couldn’t find that event" />
    return <ErrorState error={state.error} onRetry={state.retry} title="We couldn’t load the dashboard" />
  }
  if (!state.data) return <DashboardSkeleton />

  const { event, bookings, waitlist } = state.data
  const sales = salesSummary(event, bookings)
  const answers = answerSummary(event, bookings)
  const crossTabStart = defaultCrossTab(event)

  async function confirmCancel() {
    setBusy(true)
    setCancelError(null)
    try {
      await cancelBooking(cancelling.id)
      const places = cancelling.attendees.length
      setMessage(`Booking ${cancelling.reference} was cancelled. ${places === 1 ? '1 place is' : `${places} places are`} free again.`)
      setCancelling(null)
      state.retry()
    } catch (error) {
      setCancelError(error)
    } finally {
      setBusy(false)
    }
  }

  function exportCsv() {
    downloadFile(`${event.slug}-guests-${lagosDateKey()}.csv`, toCsv(guestRows(event, bookings)), 'text/csv;charset=utf-8')
  }

  return (
    <div>
      <Link to="/organise" className="inline-flex min-h-10 items-center gap-1.5 text-sm font-bold text-gele-ink">
        <Icon name="back" className="size-4" />
        Your events
      </Link>
      <div className="mt-1 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-semibold">{event.title}</h1>
          <p className="mt-1 text-ink-soft">
            {formatEventWhen(event.startsAt, event.endsAt)} · {event.venue.name}, {event.venue.city}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to={`/organise/${event.id}/edit`} className={buttonClass('outline', 'sm')}>
            <Icon name="edit" className="size-4" />
            Edit event
          </Link>
          <Link to={`/events/${event.slug}`} className={buttonClass('ghost', 'sm')}>
            <Icon name="eye" className="size-4" />
            Guest page
          </Link>
        </div>
      </div>

      {message && (
        <p
          ref={messageRef}
          tabIndex={-1}
          role="status"
          className="mt-5 flex items-center gap-2 rounded-2xl bg-teal-soft p-4 font-bold text-teal-ink outline-none"
        >
          <Icon name="check" className="size-5" />
          {message}
        </p>
      )}
      {state.status === 'error' && <ErrorState className="mt-4" error={state.error} onRetry={state.retry} title="We couldn’t refresh the numbers" />}

      <div className={`mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4 ${state.status === 'loading' ? 'opacity-60' : ''}`} aria-busy={state.status === 'loading'}>
        <StatTile
          label="Places booked"
          value={sales.sold.toLocaleString('en-NG')}
          detail={`of ${sales.capacity.toLocaleString('en-NG')} · ${Math.round((sales.sold / sales.capacity) * 100)}% full`}
        />
        <StatTile
          label="Revenue"
          value={sales.revenueKobo ? formatNaira(sales.revenueKobo) : '₦0'}
          detail={sales.discountKobo ? `after ${formatNaira(sales.discountKobo)} in promos` : 'Confirmed bookings'}
        />
        <StatTile
          label="Bookings"
          value={sales.bookings.toLocaleString('en-NG')}
          detail={sales.cancelled ? `${sales.cancelled} cancelled` : 'None cancelled'}
        />
        <StatTile label="Waitlist" value={waitlist.length.toLocaleString('en-NG')} detail={waitlist.length ? 'waiting for a place' : 'Nobody waiting'} />
      </div>

      <Section title="Tickets sold" intro="Each bar is that ticket’s quantity; full means sold out.">
        <div className="rounded-2xl bg-panel p-4 ring-1 ring-line sm:p-5">
          <SalesByType summary={sales} />
        </div>
      </Section>

      <Section
        title="Bookings"
        intro="Search, sort, open or cancel a booking. Cancelling frees its places straight away."
        action={
          <Button variant="secondary" onClick={exportCsv} disabled={sales.bookings === 0}>
            <Icon name="download" className="size-4" />
            Export guests (CSV)
          </Button>
        }
      >
        <BookingsTable bookings={bookings} onCancel={(b) => setCancelling(b)} />
      </Section>

      {crossTabStart && (
        <Section title="Orders at a glance" intro="Two questions side by side. For aso-ebi, colour × size is the tailor’s order.">
          <CrossTab event={event} bookings={bookings} initial={crossTabStart} />
        </Section>
      )}

      <Section title="Answers" intro="Confirmed bookings only. Questions asked per guest are counted per guest.">
        <AnswerSummary summaries={answers} />
      </Section>

      <Section title="Waitlist" intro="People to contact if a place opens up.">
        {waitlist.length === 0 ? (
          <p className="text-ink-faint">Nobody is on the waitlist.</p>
        ) : (
          <ul className="divide-y divide-line rounded-2xl bg-panel ring-1 ring-line">
            {waitlist.map((w) => (
              <li key={w.id} className="flex flex-wrap justify-between gap-2 p-4 text-sm">
                <span className="font-semibold">
                  {w.name}
                  {w.ticketId && <span className="font-normal text-ink-faint"> · {event.tickets.find((t) => t.id === w.ticketId)?.name ?? 'a ticket'}</span>}
                </span>
                <span className="text-ink-soft">{[w.email, formatPhoneLocal(w.phone)].filter(Boolean).join(' · ')}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <ConfirmDialog
        open={cancelling != null}
        title={`Cancel booking ${cancelling?.reference ?? ''}?`}
        tone="danger"
        confirmLabel={busy ? 'Cancelling…' : 'Cancel booking'}
        cancelLabel="Keep it"
        busy={busy}
        onConfirm={confirmCancel}
        onCancel={() => {
          setCancelling(null)
          setCancelError(null)
        }}
      >
        {cancelling && (
          <>
            <p>
              {cancelling.buyer.name}’s booking for {cancelling.attendees.length === 1 ? '1 guest' : `${cancelling.attendees.length} guests`} will be cancelled
              and the places released. This demo doesn’t send emails, so let them know yourself.
            </p>
            {cancelError && (
              <p role="alert" className="mt-2 font-bold text-danger">
                {cancelError.message}
              </p>
            )}
          </>
        )}
      </ConfirmDialog>
    </div>
  )
}
