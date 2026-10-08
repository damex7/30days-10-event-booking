import { Link } from 'react-router-dom'
import { EventCover } from './EventCover.jsx'
import { Badge } from '../ui/Badge.jsx'
import { Icon } from '../ui/Icon.jsx'
import { Skeleton } from '../ui/States.jsx'
import { categoryLabel } from '../../config.js'
import { dateBadge, formatTime, relativeDay } from '../../lib/dates.js'
import { formatNaira } from '../../lib/money.js'

/** "Free", "From ₦10,000", or "₦10,000" for single-price events. */
export function priceLine(event) {
  if (event.tickets.every((t) => t.priceKobo === 0)) return 'Free'
  if (event.isFree) return 'Free, or pay to support'
  const prices = new Set(event.tickets.map((t) => t.priceKobo))
  return prices.size === 1 ? formatNaira(event.lowestKobo) : `From ${formatNaira(event.lowestKobo)}`
}

/** The one badge that matters most for this event, if any. */
export function AvailabilityBadge({ event }) {
  if (event.soldOut) return <Badge tone="danger">Sold out · waitlist open</Badge>
  if (!event.bookable) return <Badge>Booking closed</Badge>
  if (event.remaining <= 10) return <Badge tone="gold">Only {event.remaining} left</Badge>
  const few = event.tickets.find((t) => t.status === 'few')
  if (few) return <Badge tone="gold">{few.name}: {few.remaining} left</Badge>
  return null
}

/*
  An event card styled like a small invitation: the date on a foil-edged
  tab, the title in the display serif.
  The whole card is clickable, but only the title is a link (its ::after
  stretches over the card). One link per card keeps screen-reader link
  lists and Tab order short.
*/
export function EventCard({ event }) {
  const d = dateBadge(event.startsAt)
  return (
    <article className="group relative flex flex-col overflow-hidden rounded-2xl bg-panel shadow-card ring-1 ring-line transition-shadow hover:shadow-pop">
      {/* The date tab sits outside the cover (which clips its pattern), straddling the edge. */}
      <div className="relative">
        <EventCover cover={event.cover} className="aspect-[16/8]" />
        <div className="foil-edge absolute bottom-0 left-4 translate-y-1/2 rounded-xl bg-panel px-3 py-1.5 text-center leading-tight text-ink">
          <span className="block text-[11px] font-bold tracking-wider text-gele-ink uppercase">{d.month}</span>
          <span className="block font-display text-2xl leading-none font-bold">{d.day}</span>
          <span className="block text-[11px] text-ink-faint">{d.weekday}</span>
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-2 px-4 pt-10 pb-4">
        <p className="text-xs font-bold tracking-wide text-gele-ink uppercase">{categoryLabel(event.category)}</p>
        <h3 className="font-display text-xl leading-snug font-semibold">
          <Link to={`/events/${event.slug}`} className="rounded-sm after:absolute after:inset-0 after:content-['']">
            {event.title}
          </Link>
        </h3>
        <p className="flex items-start gap-1.5 text-sm text-ink-soft">
          <Icon name="clock" className="mt-0.5 size-4 shrink-0" />
          <span>
            {relativeDay(event.startsAt, event.endsAt)} · {formatTime(event.startsAt)}
          </span>
        </p>
        <p className="flex items-start gap-1.5 text-sm text-ink-soft">
          <Icon name="pin" className="mt-0.5 size-4 shrink-0" />
          <span>
            {event.venue.name}, {event.venue.city}
          </span>
        </p>
        <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-2">
          <p className={event.isFree ? 'font-bold text-teal-ink' : 'font-bold'}>{priceLine(event)}</p>
          <AvailabilityBadge event={event} />
        </div>
      </div>
    </article>
  )
}

export function EventCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl bg-panel ring-1 ring-line">
      <Skeleton className="aspect-[16/8] rounded-none" />
      <div className="space-y-3 px-4 pt-10 pb-4">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-6 w-4/5" />
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="mt-4 h-5 w-20" />
      </div>
    </div>
  )
}
