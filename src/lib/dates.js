/*
  Dates and times, always in Lagos time.

  Every timestamp is stored as a UTC ISO string ("2026-11-14T11:00:00.000Z")
  and every timestamp we SHOW is converted to Africa/Lagos with Intl, so a
  guest checking from London or Toronto sees the time on the invitation,
  not their own clock.

  Lagos is UTC+1 all year (West Africa Time has no daylight saving), so
  turning a wall-clock time typed into <input type="datetime-local"> into a
  real instant is just "add +01:00". That fixed offset is the one shortcut
  here: for a city with daylight saving you'd need a proper time-zone
  library (or the Temporal API) to do this conversion.
*/
export const TIME_ZONE = 'Africa/Lagos'
const OFFSET = '+01:00'
const HOUR = 3_600_000
const DAY = 24 * HOUR

const valid = (d) => d instanceof Date && !Number.isNaN(d.getTime())
export const isISODate = (v) => typeof v === 'string' && valid(new Date(v)) && /^\d{4}-\d{2}-\d{2}T/.test(v)

/* ---------- Form inputs <-> stored values ---------- */

/** "2026-11-14T12:00" (Lagos wall clock, from datetime-local) → "2026-11-14T11:00:00.000Z". */
export function lagosInputToISO(value) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value ?? '')) return null
  const d = new Date(`${value}:00${OFFSET}`)
  return valid(d) ? d.toISOString() : null
}

/** The reverse: a stored instant → the "YYYY-MM-DDTHH:mm" a datetime-local input expects. */
export function isoToLagosInput(iso) {
  const d = new Date(iso)
  return valid(d) ? new Date(d.getTime() + HOUR).toISOString().slice(0, 16) : ''
}

/** The Lagos calendar date of an instant, as "YYYY-MM-DD" (the format of <input type="date">). */
export function lagosDateKey(when = new Date()) {
  const d = new Date(when)
  return valid(d) ? new Date(d.getTime() + HOUR).toISOString().slice(0, 10) : ''
}

/** Add whole days to a "YYYY-MM-DD" key. */
export function addDaysToKey(key, days) {
  const d = new Date(`${key}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/* ---------- Ranges for the browse filters ---------- */

/** The instant a Lagos calendar day starts. */
const startOfLagosDay = (key) => new Date(`${key}T00:00:00${OFFSET}`)

/**
 * "This week" = from now until the end of this Sunday, Lagos time.
 * "This month" = from now until the end of this calendar month.
 * An event matches if any part of it falls in the range (so a conference
 * that started yesterday and runs to Sunday is still "this week").
 */
export function rangeFor(when, now = new Date()) {
  const today = lagosDateKey(now)
  if (when === 'week') {
    const weekday = new Date(`${today}T12:00:00Z`).getUTCDay() // 0 = Sunday
    const daysToMonday = weekday === 0 ? 1 : 8 - weekday
    return { from: now, to: startOfLagosDay(addDaysToKey(today, daysToMonday)) }
  }
  if (when === 'month') {
    const [y, m] = today.split('-').map(Number)
    const firstOfNext = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`
    return { from: now, to: startOfLagosDay(firstOfNext) }
  }
  return null
}

export const overlaps = (startsAt, endsAt, range) => new Date(startsAt) < range.to && new Date(endsAt) > range.from

/* ---------- Display ---------- */

const fmt = (options) => new Intl.DateTimeFormat('en-GB', { timeZone: TIME_ZONE, ...options })
const dayLong = fmt({ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
const dayShort = fmt({ weekday: 'short', day: 'numeric', month: 'short' })
const dayShortYear = fmt({ weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
const time = fmt({ hour: 'numeric', minute: '2-digit', hour12: true })
const dateTime = fmt({ day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })
const parts = fmt({ day: 'numeric', month: 'short', weekday: 'short' })

/** "Saturday 14 November 2026" */
export const formatDayLong = (iso) => dayLong.format(new Date(iso))
/** "Sat 14 Nov" (adds the year when it isn't this year) */
export const formatDayShort = (iso) => (lagosDateKey(iso).slice(0, 4) === lagosDateKey().slice(0, 4) ? dayShort : dayShortYear).format(new Date(iso))
/** "12:00 pm" */
export const formatTime = (iso) =>
  time
    .format(new Date(iso))
    .replace(/\s?([ap])m$/i, ' $1m')
    .toLowerCase()
/** "14 Nov 2026, 3:42 pm" for booking timestamps */
export const formatDateTime = (iso) => dateTime.format(new Date(iso))

/** A "YYYY-MM-DD" answer to a date question → "Saturday 14 November 2026". */
export const formatDateKey = (key) => (/^\d{4}-\d{2}-\d{2}$/.test(key ?? '') ? dayLong.format(new Date(`${key}T12:00:00${OFFSET}`)) : '')

/** For the date badge on cards: { day: "14", month: "Nov", weekday: "Sat" }. */
export function dateBadge(iso) {
  const out = {}
  for (const p of parts.formatToParts(new Date(iso))) if (p.type !== 'literal') out[p.type] = p.value
  return out
}

/**
 * "Sat 14 Nov · 12:00 pm – 6:00 pm", or across days:
 * "Fri 20 Nov, 5:00 pm – Sun 22 Nov, 2:00 pm".
 */
export function formatEventWhen(startsAt, endsAt) {
  const sameDay = lagosDateKey(startsAt) === lagosDateKey(endsAt)
  if (sameDay) return `${formatDayShort(startsAt)} · ${formatTime(startsAt)} – ${formatTime(endsAt)}`
  return `${formatDayShort(startsAt)}, ${formatTime(startsAt)} – ${formatDayShort(endsAt)}, ${formatTime(endsAt)}`
}

/** "Today", "Tomorrow", "In 5 days", "Happening now", "Ended". */
export function relativeDay(startsAt, endsAt, now = new Date()) {
  if (new Date(endsAt) <= now) return 'Ended'
  if (new Date(startsAt) <= now) return 'Happening now'
  const days = Math.round((startOfLagosDay(lagosDateKey(startsAt)) - startOfLagosDay(lagosDateKey(now))) / DAY)
  if (days === 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  if (days < 7) return `In ${days} days`
  if (days < 14) return 'Next week'
  return `In ${Math.round(days / 7)} weeks`
}

/* ---------- Building seed dates ---------- */

/** An ISO instant `days` from today, at a Lagos wall-clock time like "18:30". */
export function lagosAt(days, hhmm, now = new Date()) {
  return lagosInputToISO(`${addDaysToKey(lagosDateKey(now), days)}T${hhmm}`)
}
