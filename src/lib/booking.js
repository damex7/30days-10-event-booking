import { newId } from './ids.js'
import { percentOf, sumKobo } from './money.js'

/*
  Booking maths, as pure functions: the booking form uses them to show a
  live total, and db.js uses the SAME functions to re-check a booking
  before saving it, the way a server would never trust the browser's total.
*/

/* ---------- Spots ---------- */

/**
 * How many of each ticket type are taken, counted from confirmed bookings.
 * We never store a "sold" number on the ticket: it's always worked out from
 * the bookings, so cancelling a booking frees its spots automatically and
 * the count can never drift out of step.
 */
export function soldByTicket(bookings) {
  const sold = {}
  for (const b of bookings) {
    if (b.status !== 'confirmed') continue
    for (const item of b.items) sold[item.ticketId] = (sold[item.ticketId] ?? 0) + item.quantity
  }
  return sold
}

export const NEARLY_GONE = 10 // "Only 6 left" shows at or below this many

/**
 * Ticket availability, attached to a copy of the event:
 *   ticket.sold, ticket.remaining, ticket.onSale (false after salesEndAt
 *   or once the event has started), ticket.status
 *   ('available' | 'few' | 'soldout' | 'closed')
 * plus event-level: soldOut, lowestKobo, isFree, isPast, remaining.
 */
export function withAvailability(event, bookings, now = new Date()) {
  const sold = soldByTicket(bookings.filter((b) => b.eventId === event.id))
  const started = new Date(event.startsAt) <= now
  const tickets = event.tickets.map((t) => {
    const taken = sold[t.id] ?? 0
    const remaining = Math.max(0, t.quantity - taken)
    const salesEnded = started || (t.salesEndAt != null && new Date(t.salesEndAt) <= now)
    const status = salesEnded ? 'closed' : remaining === 0 ? 'soldout' : remaining <= NEARLY_GONE ? 'few' : 'available'
    return { ...t, sold: taken, remaining, onSale: !salesEnded && remaining > 0, status }
  })
  const open = tickets.filter((t) => t.onSale)
  return {
    ...event,
    tickets,
    remaining: open.reduce((n, t) => n + t.remaining, 0),
    soldOut: !started && open.length === 0 && tickets.some((t) => t.status === 'soldout'),
    bookable: open.length > 0,
    isPast: new Date(event.endsAt) <= now,
    lowestKobo: Math.min(...event.tickets.map((t) => t.priceKobo)),
    isFree: event.tickets.some((t) => t.priceKobo === 0),
  }
}

/** The most one booking may take of a ticket: what's left, capped by the per-person max. */
export const maxFor = (ticket, maxPerBooking) => (ticket.onSale ? Math.min(ticket.remaining, maxPerBooking) : 0)

/* ---------- Guests ---------- */

export const blankAttendee = (ticketId) => ({ id: newId('att'), ticketId, name: '', email: '', phone: '', answers: {} })

/**
 * Keep the list of guests in step with the ticket quantities.
 * The guest list IS the quantity (2 Regular = 2 Regular guests), so the
 * two can never disagree. When a quantity changes:
 *   - existing guests keep their place, so nothing typed is lost and
 *     "Guest 1" (often you) never moves;
 *   - going down drops the LAST guests of that ticket type;
 *   - going up adds blank guests at the end.
 * Removing one particular guest is simpler still: the caller filters them
 * out, and the quantity drops by itself.
 */
export function syncAttendees(attendees, quantities, tickets) {
  const counts = {}
  const next = []
  for (const a of attendees) {
    if ((counts[a.ticketId] ?? 0) < (quantities[a.ticketId] ?? 0)) {
      next.push(a)
      counts[a.ticketId] = (counts[a.ticketId] ?? 0) + 1
    }
  }
  for (const t of tickets) {
    for (let n = counts[t.id] ?? 0; n < (quantities[t.id] ?? 0); n++) next.push(blankAttendee(t.id))
  }
  return next
}

/* ---------- Promo codes ---------- */

export const normaliseCode = (code) =>
  String(code ?? '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')

export const findPromo = (event, code) => event.promoCodes.find((p) => p.code === normaliseCode(code)) ?? null

/** What a promo takes off a subtotal. Fixed amounts never take the total below ₦0. */
export function promoDiscount(promo, subtotalKobo) {
  if (!promo) return 0
  if (promo.kind === 'percent') return percentOf(subtotalKobo, promo.value)
  return Math.min(promo.value, subtotalKobo)
}

export const describePromo = (promo) => (promo.kind === 'percent' ? `${promo.value}% off` : `₦${(promo.value / 100).toLocaleString('en-NG')} off`)

/* ---------- Totals ---------- */

/**
 * The order lines and totals for a set of quantities.
 * Prices come from the EVENT (never from the form), and are copied into
 * each line, so a booking keeps the price it was made at even if the
 * organiser changes it later.
 */
export function computeTotals(event, quantities, promo = null) {
  const items = event.tickets
    .filter((t) => (quantities[t.id] ?? 0) > 0)
    .map((t) => ({ ticketId: t.id, name: t.name, unitKobo: t.priceKobo, quantity: quantities[t.id], lineKobo: t.priceKobo * quantities[t.id] }))
  const subtotalKobo = sumKobo(items.map((i) => i.lineKobo))
  const discountKobo = promoDiscount(promo, subtotalKobo)
  const count = items.reduce((n, i) => n + i.quantity, 0)
  return { items, count, subtotalKobo, discountKobo, totalKobo: subtotalKobo - discountKobo }
}

/** Quantities from a list of guests: { tkt_a: 2, tkt_b: 1 }. */
export function quantitiesOf(attendees) {
  const q = {}
  for (const a of attendees) q[a.ticketId] = (q[a.ticketId] ?? 0) + 1
  return q
}
