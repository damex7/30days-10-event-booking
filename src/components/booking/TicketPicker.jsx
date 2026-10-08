import { Field } from '../../form/Field.jsx'
import { maxFor, quantitiesOf, syncAttendees } from '../../lib/booking.js'
import { cx } from '../../lib/cx.js'
import { formatPrice } from '../../lib/money.js'
import { Badge } from '../ui/Badge.jsx'
import { Icon } from '../ui/Icon.jsx'

/*
  Ticket types with − / + steppers. Changing a quantity adds or removes
  guests (see syncAttendees): the guest list IS the quantity.

  The + button stops at the lower of "what's left" and "what one booking
  may take", and says why underneath, so the limit is explained instead
  of the button just going dead. The validation rules still check both
  (spots can sell out while you're on this page).

  Each count is an <output> in a polite live region, so pressing + reads
  "Regular: 2" to screen-reader users.
*/
function Stepper({ label, value, max, onChange }) {
  const btn =
    'grid size-11 place-items-center rounded-full border border-line-strong bg-panel text-ink transition-colors hover:bg-panel-2 disabled:cursor-not-allowed disabled:opacity-40'
  return (
    <div className="flex items-center gap-1">
      <button type="button" className={btn} onClick={() => onChange(value - 1)} disabled={value <= 0} aria-label={`Remove one ${label} ticket`}>
        <Icon name="minus" className="size-5" />
      </button>
      <output aria-live="polite" aria-label={`${label} tickets`} className="w-10 text-center font-mono text-lg font-semibold">
        {value}
      </output>
      <button type="button" className={btn} onClick={() => onChange(value + 1)} disabled={value >= max} aria-label={`Add one ${label} ticket`}>
        <Icon name="plus" className="size-5" />
      </button>
    </div>
  )
}

export function TicketPicker({ form, event, onGuestsChanged }) {
  const attendees = form.values.attendees
  const qty = quantitiesOf(attendees)
  const total = attendees.length
  const roomLeft = event.maxPerBooking - total

  const setQuantity = (ticketId, n) => {
    form.setValues((v) => ({ ...v, attendees: syncAttendees(v.attendees, { ...quantitiesOf(v.attendees), [ticketId]: Math.max(0, n) }, event.tickets) }))
    onGuestsChanged?.()
  }

  return (
    <Field form={form} name="tickets" label="How many tickets?" hint={`Up to ${event.maxPerBooking} per booking. Each ticket is one guest.`} group>
      {() => (
        <ul className="divide-y divide-line rounded-2xl border border-line bg-panel">
          {event.tickets.map((t) => {
            const n = qty[t.id] ?? 0
            const max = Math.min(maxFor(t, event.maxPerBooking), n + Math.max(0, roomLeft))
            const why =
              t.status === 'soldout'
                ? null
                : n > 0 && n >= t.remaining
                  ? `That’s the last ${t.remaining === 1 ? 'one' : t.remaining}.`
                  : n > 0 && roomLeft <= 0
                    ? `${event.maxPerBooking} per booking is the most.`
                    : null
            return (
              <li key={t.id} className={cx('flex flex-wrap items-center gap-3 p-4', !t.onSale && n === 0 && 'opacity-70')}>
                <div className="min-w-0 flex-1 basis-48">
                  <p className="font-bold">{t.name}</p>
                  <p className={t.priceKobo === 0 ? 'font-semibold text-teal-ink' : 'font-semibold'}>{formatPrice(t.priceKobo)}</p>
                  {t.description && <p className="text-sm text-ink-faint">{t.description}</p>}
                  <p className="mt-1 text-sm">
                    {t.status === 'soldout' ? (
                      <Badge tone="danger">Sold out</Badge>
                    ) : t.status === 'closed' ? (
                      <Badge>Sales ended</Badge>
                    ) : t.status === 'few' ? (
                      <Badge tone="gold">Only {t.remaining} left</Badge>
                    ) : null}
                    {why && <span className="text-ink-faint"> {why}</span>}
                  </p>
                </div>
                {t.onSale || n > 0 ? <Stepper label={t.name} value={n} max={max} onChange={(next) => setQuantity(t.id, next)} /> : null}
              </li>
            )
          })}
        </ul>
      )}
    </Field>
  )
}
