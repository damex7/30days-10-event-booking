import { Link, useParams } from 'react-router-dom'
import { EventCover } from '../components/events/EventCover.jsx'
import { Button } from '../components/ui/Button.jsx'
import { Icon } from '../components/ui/Icon.jsx'
import { ErrorState, LoadingNote, Skeleton } from '../components/ui/States.jsx'
import { APP_NAME } from '../config.js'
import { useAsync } from '../hooks/useAsync.js'
import { useDocumentTitle } from '../hooks/useDocumentTitle.js'
import { formatDayLong, formatTime } from '../lib/dates.js'
import { getBooking } from '../lib/db.js'
import { answerRows } from '../lib/questions.js'
import NotFound from './NotFound.jsx'

/*
  Printable tickets: one per guest, each kept whole on a page
  (break-inside: avoid, see @media print in index.css). The header,
  footer and buttons carry data-print-hide, so only the tickets print.
  There's no QR code yet: check-in with QR codes is a later project.
*/
export default function PrintTicket() {
  const { reference } = useParams()
  const state = useAsync((signal) => getBooking(reference, { signal }), [reference])
  useDocumentTitle(state.data ? `Tickets ${state.data.booking.reference}` : 'Tickets')

  if (state.status === 'error') {
    if (state.error?.code === 'NOT_FOUND') return <NotFound title="We couldn’t find that booking" />
    return <ErrorState error={state.error} onRetry={state.retry} title="We couldn’t load your tickets" />
  }
  if (!state.data) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <LoadingNote>Loading your tickets…</LoadingNote>
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    )
  }

  const { booking, event } = state.data
  const total = booking.attendees.length
  const ticketName = (id) => booking.items.find((i) => i.ticketId === id)?.name ?? 'Ticket'

  return (
    <div className="mx-auto max-w-2xl">
      <div data-print-hide className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link to={`/bookings/${booking.reference}`} className="inline-flex min-h-10 items-center gap-1.5 text-sm font-bold text-gele-ink">
          <Icon name="back" className="size-4" />
          Back to your booking
        </Link>
        <Button onClick={() => window.print()}>
          <Icon name="printer" className="size-4" />
          Print or save as PDF
        </Button>
      </div>
      <h1 className="sr-only">Tickets for {event.title}</h1>

      {booking.status === 'cancelled' && <p className="mb-4 rounded-xl bg-danger-soft p-3 font-bold text-danger">This booking was cancelled. These tickets are no longer valid.</p>}

      <ol className="space-y-6">
        {booking.attendees.map((a, i) => (
          <li key={a.id} data-print-ticket className="foil-edge overflow-hidden rounded-2xl bg-panel shadow-card print:border-2">
            <EventCover cover={event.cover} className="h-14 print:hidden" />
            <div className="grid sm:grid-cols-[1fr_auto] print:grid-cols-[1fr_auto]">
              <div className="p-5">
                <p className="text-xs font-bold tracking-widest text-gele-ink uppercase">
                  {APP_NAME} · Admit one
                </p>
                <h2 className="mt-1 font-display text-2xl leading-tight font-semibold">{event.title}</h2>
                <p className="mt-2 text-sm">
                  <span className="font-bold">{formatDayLong(event.startsAt)}</span>, {formatTime(event.startsAt)} (Lagos time)
                </p>
                <p className="text-sm">
                  {event.venue.name}, {event.venue.address}, {event.venue.city}
                </p>
                <p className="mt-4 text-xs tracking-wide text-ink-faint uppercase">Guest</p>
                <p className="text-xl font-bold">{a.name}</p>
                <p className="text-sm font-bold text-gele-ink">{ticketName(a.ticketId)}</p>
                {answerRows(event.questions, a.answers).length > 0 && (
                  <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 text-sm">
                    {answerRows(event.questions, a.answers).map((r) => (
                      <div key={r.id} className="contents">
                        <dt className="text-ink-faint">{r.label}</dt>
                        <dd className="font-semibold">{r.value}</dd>
                      </div>
                    ))}
                  </dl>
                )}
              </div>
              {/* The stub: a dashed tear line and the reference, readable at the gate. */}
              <div className="flex flex-row items-center justify-between gap-4 border-t-2 border-dashed border-line-strong p-5 sm:flex-col sm:justify-center sm:border-t-0 sm:border-l-2 print:flex-col print:border-t-0 print:border-l-2">
                <div className="text-center">
                  <p className="text-xs tracking-wide text-ink-faint uppercase">Reference</p>
                  <p className="font-mono text-lg font-semibold tracking-wider">{booking.reference}</p>
                </div>
                <p className="font-mono text-sm text-ink-soft">
                  {i + 1} of {total}
                </p>
              </div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}
