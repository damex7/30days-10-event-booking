import { STORAGE_PREFIX } from '../config.js'
import { findPromo, normaliseCode, promoDiscount, describePromo, withAvailability } from './booking.js'
import { overlaps, rangeFor } from './dates.js'
import { createSeed } from './seed.js'
import { cleanDb } from './schema.js'
import { readValidated, removeKey, writeJSON } from './storage.js'

/*
  The app's only door to its data: a pretend server that lives in
  localStorage. Pages call these async functions and never touch storage
  themselves, so swapping this file for real fetch() calls later changes
  nothing else.

  Like a server, it:
    - waits a little (300–700ms) before answering, so loading states are real;
    - re-reads and re-validates storage on every call (another tab may have
      written to it; DevTools may have mangled it);
    - computes derived numbers (spots left, sold out) on the "server";
    - returns COPIES, never its own objects, so a page can't change the
      "database" by mutating what it got back;
    - re-checks everything it's sent and answers with an ApiError.

  Simulate failures from the address bar:
    ?fail=1    every request fails (test error states and Retry)
    ?fail=0.5  about half fail
*/

const KEY = `${STORAGE_PREFIX}:db:v1`

export class ApiError extends Error {
  /** code: 'NOT_FOUND' | 'INVALID' | 'SOLD_OUT' | 'PROMO_INVALID' | 'NETWORK' | 'STORAGE'. details: field → message. */
  constructor(code, message, details = null) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.details = details
  }
}

function failRate() {
  const raw = new URLSearchParams(window.location.search).get('fail')
  const rate = raw == null ? 0 : Number(raw)
  return Number.isFinite(rate) ? Math.min(Math.max(rate, 0), 1) : 0
}

/** Wait like a network round trip, honour an AbortSignal, and maybe fail on purpose. */
async function respond(signal) {
  const ms = 300 + Math.random() * 400
  await new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms)
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer)
        reject(new DOMException('Aborted', 'AbortError'))
      },
      { once: true },
    )
  })
  if (Math.random() < failRate()) throw new ApiError('NETWORK', 'We couldn’t reach the server. Check your connection and try again.')
}

/* ---------- Storage ---------- */

function load() {
  const { status, value } = readValidated(KEY, cleanDb)
  if (status === 'ok') return value
  // First visit, or saved data we couldn't use (storage.js kept a backup copy): start from the demo data.
  const seed = createSeed()
  writeJSON(KEY, seed)
  return seed
}

function save(db) {
  if (!writeJSON(KEY, db)) throw new ApiError('STORAGE', 'Your browser wouldn’t let us save. Free some space or leave private browsing, then try again.')
}

const copy = (v) => structuredClone(v)
const now = () => new Date()

function eventOr404(db, match) {
  const event = db.events.find(match)
  if (!event) throw new ApiError('NOT_FOUND', 'We couldn’t find that event. It may have been removed.')
  return event
}

/* ---------- Events ---------- */

/** What guests may see: everything except the promo codes (those are checked on the "server"). */
// eslint-disable-next-line no-unused-vars
const toPublic = ({ promoCodes, ...event }) => ({ ...event, hasPromoCodes: promoCodes.length > 0 })

const fold = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()

/**
 * Upcoming events (not yet ended), soonest first, with availability.
 * filters: { q, city, category, when: 'week'|'month', price: 'free'|'paid' }
 * "Free" means you can get in for ₦0 (at least one free ticket type);
 * "Paid" means every ticket type costs money.
 * Search ignores accents, so "dayo" finds "Dàyọ̀".
 */
export async function getEvents(filters = {}, { signal } = {}) {
  await respond(signal)
  const db = load()
  const range = rangeFor(filters.when)
  const words = fold(filters.q).split(/\s+/).filter(Boolean)
  return copy(
    db.events
      .map((e) => toPublic(withAvailability(e, db.bookings)))
      .filter((e) => !e.isPast)
      .filter((e) => !filters.city || e.venue.city === filters.city)
      .filter((e) => !filters.category || e.category === filters.category)
      .filter((e) => !range || overlaps(e.startsAt, e.endsAt, range))
      .filter((e) => (filters.price === 'free' ? e.isFree : filters.price === 'paid' ? !e.isFree : true))
      .filter((e) => {
        if (words.length === 0) return true
        const text = fold([e.title, e.summary, e.venue.name, e.venue.address, e.venue.city, e.organiser.name].join(' '))
        return words.every((w) => text.includes(w))
      })
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
  )
}

/** One event by its URL slug, with availability. */
export async function getEvent(slug, { signal } = {}) {
  await respond(signal)
  const db = load()
  return copy(toPublic(withAvailability(eventOr404(db, (e) => e.slug === slug), db.bookings)))
}

/** The organiser's list: every event, past ones included, with availability and booking counts. */
export async function getOrganiserEvents({ signal } = {}) {
  await respond(signal)
  const db = load()
  return copy(
    db.events
      .map((e) => ({
        ...withAvailability(e, db.bookings),
        bookingCount: db.bookings.filter((b) => b.eventId === e.id && b.status === 'confirmed').length,
      }))
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
  )
}

/* ---------- Waitlist ---------- */

export async function joinWaitlist(eventId, { name, email, phone, ticketId = null }, { signal } = {}) {
  await respond(signal)
  const db = load()
  eventOr404(db, (e) => e.id === eventId)
  const entry = { id: `wl_${crypto.randomUUID().slice(0, 8)}`, eventId, ticketId, name, email, phone, createdAt: now().toISOString() }
  db.waitlist.push(entry)
  save(db)
  return copy(entry)
}

export async function getWaitlist(eventId, { signal } = {}) {
  await respond(signal)
  return copy(load().waitlist.filter((w) => w.eventId === eventId))
}

/* ---------- Promo codes ---------- */

/**
 * Check a promo code, as a server would (the codes never need to be sent to
 * the browser). Resolves with { code, label, discountKobo } or rejects
 * with ApiError('PROMO_INVALID').
 */
export async function checkPromo(eventId, code, subtotalKobo, { signal } = {}) {
  await respond(signal)
  const event = eventOr404(load(), (e) => e.id === eventId)
  const promo = findPromo(event, code)
  if (!promo) throw new ApiError('PROMO_INVALID', `“${normaliseCode(code)}” isn’t a valid code for this event. Check the spelling, or remove it to continue.`)
  if (subtotalKobo === 0) throw new ApiError('PROMO_INVALID', 'Your tickets are free, so there’s nothing to discount. Remove the code to continue.')
  return { code: promo.code, label: describePromo(promo), discountKobo: promoDiscount(promo, subtotalKobo) }
}

/* ---------- Demo ---------- */

/** Throw away everything and start again from the demo data. */
export async function resetDemoData({ signal } = {}) {
  await respond(signal)
  removeKey(KEY)
  save(createSeed())
}
