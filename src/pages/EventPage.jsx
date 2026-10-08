import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { EventCover } from '../components/events/EventCover.jsx'
import { priceLine } from '../components/events/EventCard.jsx'
import { WaitlistForm } from '../components/events/WaitlistForm.jsx'
import { Badge } from '../components/ui/Badge.jsx'
import { buttonClass } from '../components/ui/Button.jsx'
import { Icon } from '../components/ui/Icon.jsx'
import { ErrorState, LoadingNote, Skeleton } from '../components/ui/States.jsx'
import { categoryLabel } from '../config.js'
import { useAsync } from '../hooks/useAsync.js'
import { useDocumentTitle } from '../hooks/useDocumentTitle.js'
import { getEvent } from '../lib/db.js'
import { formatDayLong, formatDateTime, formatTime, lagosDateKey, relativeDay } from '../lib/dates.js'
import { formatPrice } from '../lib/money.js'
import { formatPhoneLocal } from '../lib/phone.js'
import NotFound from './NotFound.jsx'

function TicketStatus({ ticket }) {
  if (ticket.status === 'soldout') return <Badge tone="danger">Sold out</Badge>
  if (ticket.status === 'closed') return <Badge>Sales ended</Badge>
  if (ticket.status === 'few') return <Badge tone="gold">Only {ticket.remaining} left</Badge>
  return <span className="text-sm text-ink-faint">{ticket.remaining.toLocaleString('en-NG')} left</span>
}

/** The ticket card: every type, its price and what's left, then Book (or the waitlist). */
function Tickets({ event }) {
  const [waitFor, setWaitFor] = useState(null) // null | '' (any) | ticketId
  const soldOutTypes = event.tickets.filter((t) => t.status === 'soldout')

  return (
    <section aria-labelledby="tickets-h" className="foil-edge rounded-2xl bg-panel p-5 shadow-card">
      <h2 id="tickets-h" className="font-display text-2xl font-semibold">
        Tickets
      </h2>
      <ul className="mt-3 divide-y divide-line">
        {event.tickets.map((t) => (
          <li key={t.id} className="py-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-bold">{t.name}</p>
                {t.description && <p className="text-sm text-ink-soft">{t.description}</p>}
                {t.salesEndAt && t.status !== 'closed' && <p className="mt-0.5 text-xs text-ink-faint">Sales end {formatDateTime(t.salesEndAt)}</p>}
              </div>
              <div className="shrink-0 text-right">
                <p className={t.priceKobo === 0 ? 'font-bold text-teal-ink' : 'font-bold'}>{formatPrice(t.priceKobo)}</p>
                <TicketStatus ticket={t} />
              </div>
            </div>
          </li>
        ))}
      </ul>

      {event.bookable ? (
        <>
          <Link to="book" className={buttonClass('primary', 'lg', 'mt-2 w-full')}>
            <Icon name="ticket" className="size-5" />
            Book your place
          </Link>
          <p className="mt-2 text-center text-xs text-ink-faint">Up to {event.maxPerBooking} per booking · no payment in this demo</p>
          {soldOutTypes.length > 0 && waitFor == null && (
            <p className="mt-3 text-center text-sm">
              {soldOutTypes.map((t) => t.name).join(' and ')} {soldOutTypes.length === 1 ? 'is' : 'are'} sold out.{' '}
              <button type="button" className="font-bold text-gele-ink underline underline-offset-2" onClick={() => setWaitFor(soldOutTypes.length === 1 ? soldOutTypes[0].id : '')}>
                Join the waitlist
              </button>
            </p>
          )}
        </>
      ) : event.soldOut ? (
        <div className="mt-2 rounded-xl bg-danger-soft p-3 text-center">
          <p className="font-bold text-danger">Sold out</p>
          <p className="text-sm text-ink-soft">Every place has gone. Join the waitlist and we’ll tell you if one opens up.</p>
        </div>
      ) : (
        <p className="mt-2 rounded-xl bg-panel-2 p-3 text-center font-bold text-ink-soft">{event.isPast ? 'This event has ended.' : 'Booking has closed for this event.'}</p>
      )}

      {(event.soldOut || waitFor != null) && (
        <div className="mt-4 border-t border-line pt-4">
          <h3 className="mb-3 font-bold">Join the waitlist</h3>
          <WaitlistForm event={event} ticketId={waitFor ?? ''} />
        </div>
      )}
    </section>
  )
}

function EventSkeleton() {
  return (
    <div>
      <LoadingNote>Loading event…</LoadingNote>
      <Skeleton className="-mx-4 -mt-6 h-48 rounded-none sm:h-64" />
      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_380px]">
        <div className="space-y-4">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-10 w-4/5" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
        <Skeleton className="h-80 w-full rounded-2xl" />
      </div>
    </div>
  )
}

function Detail({ icon, title, children }) {
  return (
    <div className="flex gap-3">
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-gele-soft text-gele-ink">
        <Icon name={icon} className="size-5" />
      </span>
      <div>
        <p className="font-bold">{title}</p>
        <div className="text-ink-soft">{children}</div>
      </div>
    </div>
  )
}

export default function EventPage() {
  const { slug } = useParams()
  const state = useAsync((signal) => getEvent(slug, { signal }), [slug])
  const event = state.data
  useDocumentTitle(event?.title)

  if (state.status === 'error') {
    if (state.error?.code === 'NOT_FOUND') return <NotFound title="We couldn’t find that event" />
    return <ErrorState error={state.error} onRetry={state.retry} title="We couldn’t load this event" />
  }
  if (!event) return <EventSkeleton />

  const sameDay = lagosDateKey(event.startsAt) === lagosDateKey(event.endsAt)
  const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${event.venue.name}, ${event.venue.address}, ${event.venue.city}`)}`

  return (
    <article>
      <EventCover cover={event.cover} className="-mx-4 -mt-6 h-40 sm:h-64">
        <div className="absolute inset-x-0 top-0 mx-auto max-w-6xl px-4 pt-4">
          <Link to="/" className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-panel/90 px-3.5 text-sm font-bold text-ink shadow-card">
            <Icon name="back" className="size-4" />
            All events
          </Link>
        </div>
      </EventCover>

      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_380px]">
        <div className="min-w-0">
          <p className="text-sm font-bold tracking-wide text-gele-ink uppercase">
            {categoryLabel(event.category)} · {relativeDay(event.startsAt, event.endsAt)}
          </p>
          <h1 className="mt-2 font-display text-4xl leading-tight font-semibold sm:text-5xl">{event.title}</h1>
          {event.summary && <p className="mt-3 text-lg text-ink-soft">{event.summary}</p>}

          <div className="mt-6 grid gap-5 rounded-2xl bg-panel p-5 ring-1 ring-line sm:grid-cols-2">
            <Detail icon="calendar" title={sameDay ? formatDayLong(event.startsAt) : `${formatDayLong(event.startsAt)} to`}>
              {sameDay ? (
                <p>
                  {formatTime(event.startsAt)} – {formatTime(event.endsAt)}
                </p>
              ) : (
                <p>
                  {formatDayLong(event.endsAt)}
                  <br />
                  Starts {formatTime(event.startsAt)}, ends {formatTime(event.endsAt)}
                </p>
              )}
              <p className="text-sm text-ink-faint">Lagos time (WAT)</p>
            </Detail>
            <Detail icon="pin" title={event.venue.name}>
              <p>
                {event.venue.address}, {event.venue.city}
              </p>
              <a href={mapUrl} target="_blank" rel="noreferrer" className="text-sm font-bold text-gele-ink underline underline-offset-2">
                Open in Maps<span className="sr-only"> (opens in a new tab)</span>
              </a>
            </Detail>
          </div>

          <section aria-labelledby="about-h" className="mt-8">
            <h2 id="about-h" className="font-display text-2xl font-semibold">
              About this event
            </h2>
            <div className="mt-3 max-w-prose space-y-3 text-ink-soft">
              {event.description.split(/\n{2,}/).map((para, i) => (
                <p key={i} className="whitespace-pre-line">
                  {para}
                </p>
              ))}
            </div>
          </section>

          <section aria-labelledby="org-h" className="mt-8 rounded-2xl bg-panel p-5 ring-1 ring-line">
            <h2 id="org-h" className="text-sm font-bold tracking-wide text-ink-faint uppercase">
              Organised by
            </h2>
            <p className="mt-1 font-display text-xl font-semibold">{event.organiser.name}</p>
            <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm">
              {event.organiser.email && (
                <a href={`mailto:${event.organiser.email}`} className="font-bold text-gele-ink underline underline-offset-2">
                  {event.organiser.email}
                </a>
              )}
              {event.organiser.phone && (
                <a href={`tel:${event.organiser.phone}`} className="font-bold text-gele-ink underline underline-offset-2">
                  {formatPhoneLocal(event.organiser.phone)}
                </a>
              )}
            </p>
          </section>
        </div>

        <div className="lg:sticky lg:top-24 lg:self-start">
          <Tickets event={event} />
        </div>
      </div>

      {/* Phones: Book stays in reach at the bottom of the screen. */}
      {event.bookable && (
        <div data-sticky-bar className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-panel/95 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur lg:hidden">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
            <div>
              <p className="text-xs text-ink-faint">Tickets</p>
              <p className="font-bold">{priceLine(event)}</p>
            </div>
            <Link to="book" className={buttonClass('primary', 'md')}>
              Book now
            </Link>
          </div>
        </div>
      )}
    </article>
  )
}

