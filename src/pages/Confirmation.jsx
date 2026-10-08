import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { OrderSummary } from '../components/booking/OrderSummary.jsx'
import { EventCover } from '../components/events/EventCover.jsx'
import { Badge } from '../components/ui/Badge.jsx'
import { Button, buttonClass } from '../components/ui/Button.jsx'
import { Icon } from '../components/ui/Icon.jsx'
import { ErrorState, LoadingNote, Skeleton } from '../components/ui/States.jsx'
import { useAsync } from '../hooks/useAsync.js'
import { useDocumentTitle } from '../hooks/useDocumentTitle.js'
import { formatDateTime, formatDayLong, formatEventWhen } from '../lib/dates.js'
import { getBooking } from '../lib/db.js'
import { buildIcs, downloadFile } from '../lib/ics.js'
import { formatPhoneLocal } from '../lib/phone.js'
import { answerRows } from '../lib/questions.js'
import { whatsappShareUrl } from '../lib/whatsapp.js'
import NotFound from './NotFound.jsx'

function Answers({ rows }) {
  if (rows.length === 0) return null
  return (
    <dl className="mt-2 grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
      {rows.map((r) => (
        <div key={r.id} className="contents">
          <dt className="text-ink-faint">{r.label}</dt>
          <dd className="font-semibold">{r.value}</dd>
        </div>
      ))}
    </dl>
  )
}

function ConfirmationSkeleton() {
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <LoadingNote>Loading your booking…</LoadingNote>
      <Skeleton className="h-10 w-2/3" />
      <Skeleton className="h-72 w-full rounded-2xl" />
      <Skeleton className="h-40 w-full rounded-2xl" />
    </div>
  )
}

export default function Confirmation() {
  const { reference } = useParams()
  const location = useLocation()
  const justBooked = location.state?.justBooked === true
  const state = useAsync((signal) => getBooking(reference, { signal }), [reference])
  const [copied, setCopied] = useState(false)
  const headingRef = useRef(null)
  useDocumentTitle(state.data ? `Booking ${state.data.booking.reference}` : 'Your booking')

  // After booking, focus moves to "You're booked!", so screen-reader users hear the result first.
  useEffect(() => {
    if (state.data && justBooked) headingRef.current?.focus()
  }, [state.data, justBooked])

  if (state.status === 'error') {
    if (state.error?.code === 'NOT_FOUND') return <NotFound title="We couldn’t find that booking">Check the reference: it looks like IPE-7KQ3HX.</NotFound>
    return <ErrorState error={state.error} onRetry={state.retry} title="We couldn’t load your booking" />
  }
  if (!state.data) return <ConfirmationSkeleton />

  const { booking, event } = state.data
  const cancelled = booking.status === 'cancelled'
  const eventUrl = `${window.location.origin}/events/${event.slug}`
  const guests = booking.attendees.length
  const ticketName = (id) => booking.items.find((i) => i.ticketId === id)?.name ?? 'Ticket'
  const totals = {
    items: booking.items.map((i) => ({ ...i, lineKobo: i.unitKobo * i.quantity })),
    count: guests,
    subtotalKobo: booking.subtotalKobo,
    discountKobo: booking.discountKobo,
    totalKobo: booking.totalKobo,
  }

  function addToCalendar() {
    const ics = buildIcs({
      uid: `${booking.reference}@ipe.example`,
      title: event.title,
      description: `Booking ${booking.reference} · ${guests === 1 ? '1 guest' : `${guests} guests`}\n${eventUrl}`,
      location: `${event.venue.name}, ${event.venue.address}, ${event.venue.city}`,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      url: eventUrl,
    })
    downloadFile(`${event.slug}.ics`, ics, 'text/calendar;charset=utf-8')
  }

  async function copyReference() {
    try {
      await navigator.clipboard.writeText(booking.reference)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      // Clipboard blocked (e.g. not https): the reference is on screen to copy by hand.
    }
  }

  const shareText = `I’m going to ${event.title} 🎉\n${formatDayLong(event.startsAt)} · ${event.venue.name}, ${event.venue.city}\nBook your place: ${eventUrl}`

  return (
    <div className="mx-auto max-w-3xl">
      {cancelled ? (
        <div role="status" className="mb-6 rounded-2xl bg-danger-soft p-4">
          <p className="font-bold text-danger">This booking was cancelled</p>
          <p className="text-sm text-ink-soft">Cancelled {formatDateTime(booking.cancelledAt)}. The places have been released.</p>
        </div>
      ) : null}

      <h1 ref={headingRef} tabIndex={-1} className="font-display text-4xl font-semibold sm:text-5xl">
        {cancelled ? 'Booking details' : justBooked ? 'You’re booked!' : 'Your booking'}
      </h1>
      {!cancelled && (
        <p className="mt-2 text-lg text-ink-soft">
          {justBooked ? `See you there, ${booking.buyer.name.split(' ')[0]}. ` : ''}Show your booking reference at the entrance.
        </p>
      )}

      {/* The invitation card */}
      <section aria-label="Booking summary" className="foil-edge mt-6 overflow-hidden rounded-2xl bg-panel shadow-card">
        <EventCover cover={event.cover} className="h-20" />
        <div className="p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold tracking-widest text-ink-faint uppercase">Booking reference</p>
              <p className="font-mono text-3xl font-semibold tracking-wider">{booking.reference}</p>
            </div>
            <Button variant="outline" size="sm" onClick={copyReference}>
              <Icon name={copied ? 'check' : 'copy'} className="size-4" />
              <span aria-live="polite">{copied ? 'Copied' : 'Copy reference'}</span>
            </Button>
          </div>

          <h2 className="mt-5 font-display text-2xl font-semibold">{event.title}</h2>
          <p className="mt-1 flex items-start gap-1.5 text-ink-soft">
            <Icon name="calendar" className="mt-0.5 size-4 shrink-0" />
            {formatEventWhen(event.startsAt, event.endsAt)} (Lagos time)
          </p>
          <p className="mt-1 flex items-start gap-1.5 text-ink-soft">
            <Icon name="pin" className="mt-0.5 size-4 shrink-0" />
            {event.venue.name}, {event.venue.address}, {event.venue.city}
          </p>

          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            <div>
              <h3 className="text-sm font-bold tracking-wide text-ink-faint uppercase">Booked by</h3>
              <p className="mt-1 font-bold">{booking.buyer.name}</p>
              <p className="text-sm text-ink-soft">{booking.buyer.email}</p>
              <p className="text-sm text-ink-soft">{formatPhoneLocal(booking.buyer.phone)}</p>
              <p className="mt-1 text-xs text-ink-faint">Booked {formatDateTime(booking.createdAt)}</p>
            </div>
            <div>
              <h3 className="text-sm font-bold tracking-wide text-ink-faint uppercase">Order</h3>
              <OrderSummary totals={totals} className="mt-1" />
              {booking.promo && <p className="mt-1 text-xs text-teal-ink">Promo {booking.promo.code} applied</p>}
            </div>
          </div>

          <Answers rows={answerRows(event.questions, booking.answers)} />
        </div>
      </section>

      {/* Actions */}
      {!cancelled && (
        <div className="mt-6 grid gap-2 sm:grid-cols-3">
          <Button variant="outline" onClick={addToCalendar}>
            <Icon name="calendar" className="size-4" />
            Add to calendar
          </Button>
          <a href={whatsappShareUrl(shareText)} target="_blank" rel="noreferrer" className={buttonClass('whatsapp')}>
            <Icon name="chat" className="size-4" />
            Share on WhatsApp<span className="sr-only"> (opens WhatsApp)</span>
          </a>
          <Link to="ticket" className={buttonClass('primary')}>
            <Icon name="printer" className="size-4" />
            Print {guests === 1 ? 'ticket' : 'tickets'}
          </Link>
        </div>
      )}

      <section aria-labelledby="guests-h" className="mt-8">
        <h2 id="guests-h" className="font-display text-2xl font-semibold">
          {guests === 1 ? '1 guest' : `${guests} guests`}
        </h2>
        <ul className="mt-3 space-y-3">
          {booking.attendees.map((a, i) => (
            <li key={a.id} className="rounded-2xl border border-line bg-panel p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-bold">
                  {i + 1}. {a.name}
                </p>
                <Badge tone="gele">{ticketName(a.ticketId)}</Badge>
              </div>
              <p className="text-sm text-ink-soft">{[a.email, formatPhoneLocal(a.phone)].filter(Boolean).join(' · ')}</p>
              <Answers rows={answerRows(event.questions, a.answers)} />
            </li>
          ))}
        </ul>
      </section>

      <p className="mt-8 text-center">
        <Link to="/" className="font-bold text-gele-ink underline underline-offset-2">
          Browse more events
        </Link>
      </p>
    </div>
  )
}
