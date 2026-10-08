import { FieldScope } from '../../form/Field.jsx'
import { DateTimeField, NumberField, RadioGroupField, TextField } from '../../form/controls.jsx'
import { LIMITS } from '../../config.js'
import { blankTicket } from '../../lib/eventRules.js'
import { Badge } from '../ui/Badge.jsx'
import { Button } from '../ui/Button.jsx'
import { Icon } from '../ui/Icon.jsx'
import { Field } from '../../form/Field.jsx'
import { ListItemActions, moveItem, refocusMoved } from './ListItemActions.jsx'

/*
  Step 3: ticket types (add, remove, reorder), the per-person limit and
  promo codes. A ticket that already has bookings can't be removed and its
  quantity can't go below what's booked: those bookings point at it.
*/
export function TicketsStep({ form, sold, announce }) {
  const tickets = form.values.tickets

  const move = (from, to, direction) => {
    const name = tickets[from].name || `Ticket ${from + 1}`
    form.setValues((v) => ({ ...v, tickets: moveItem(v.tickets, from, to) }))
    form.forget((p) => p.startsWith('tickets.'))
    announce(`${name} moved to position ${to + 1} of ${tickets.length}.`)
    refocusMoved(`mv-${tickets[from].id}`, direction)
  }
  const remove = (index) => {
    const name = tickets[index].name || `Ticket ${index + 1}`
    form.setValues((v) => ({ ...v, tickets: v.tickets.filter((_, i) => i !== index) }))
    form.forget((p) => p.startsWith('tickets.'))
    announce(`${name} removed.`)
    requestAnimationFrame(() => document.getElementById('add-ticket')?.focus())
  }
  const add = () => {
    const ticket = blankTicket()
    form.setValues((v) => ({ ...v, tickets: [...v.tickets, ticket] }))
    requestAnimationFrame(() => document.getElementById(form.idFor(`tickets.${tickets.length}.name`))?.focus())
  }

  const promos = form.values.promoCodes
  const addPromo = () => {
    form.setValues((v) => ({ ...v, promoCodes: [...v.promoCodes, { code: '', kind: 'percent', value: '10' }] }))
    requestAnimationFrame(() => document.getElementById(form.idFor(`promoCodes.${promos.length}.code`))?.focus())
  }
  const removePromo = (index) => {
    form.setValues((v) => ({ ...v, promoCodes: v.promoCodes.filter((_, i) => i !== index) }))
    form.forget((p) => p.startsWith('promoCodes.'))
    requestAnimationFrame(() => document.getElementById('add-promo')?.focus())
  }

  return (
    <div className="space-y-6">
      <Field form={form} name="tickets" label="Ticket types" hint="Guests choose from these, in this order. Use ₦0 for free tickets." group>
        {() => (
          <ol className="space-y-4">
            {tickets.map((t, i) => {
              const booked = sold[t.id] ?? 0
              const name = t.name.trim() || `Ticket ${i + 1}`
              return (
                <li key={t.id} className="rounded-2xl border border-line bg-panel p-4 sm:p-5">
                  <FieldScope label={name}>
                    <div className="mb-4 flex items-center justify-between gap-2">
                      <p className="flex flex-wrap items-center gap-2 font-display text-lg font-semibold">
                        {i + 1}. {name}
                        {booked > 0 && <Badge tone="teal">{booked} booked</Badge>}
                      </p>
                      <ListItemActions
                        idBase={`mv-${t.id}`}
                        name={name}
                        index={i}
                        count={tickets.length}
                        onMove={move}
                        onRemove={remove}
                        removeDisabledReason={booked > 0 ? `${booked} booked: this ticket can’t be removed` : tickets.length === 1 ? 'An event needs at least one ticket' : ''}
                      />
                    </div>
                    <div className="grid gap-5 sm:grid-cols-2">
                      <TextField form={form} name={`tickets.${i}.name`} label="Ticket name" hint="E.g. Regular, VIP, Table for 6." />
                      <div className="grid grid-cols-2 gap-3">
                        <NumberField form={form} name={`tickets.${i}.price`} label="Price (₦)" hint="Whole naira." />
                        <NumberField form={form} name={`tickets.${i}.quantity`} label="Quantity" hint={booked ? `At least ${booked}.` : 'How many.'} />
                      </div>
                      <TextField form={form} name={`tickets.${i}.description`} label="What’s included" optional className="sm:col-span-2" />
                      <DateTimeField form={form} name={`tickets.${i}.salesEndAt`} label="Sales end" optional hint="Lagos time. Leave empty to sell until the event starts." />
                    </div>
                  </FieldScope>
                </li>
              )
            })}
          </ol>
        )}
      </Field>
      <Button id="add-ticket" variant="secondary" onClick={add} disabled={tickets.length >= LIMITS.ticketTypes}>
        <Icon name="plus" className="size-4" />
        Add a ticket type
      </Button>

      <div className="rounded-2xl border border-line bg-panel p-4 sm:p-5">
        <NumberField form={form} name="maxPerBooking" label="Most tickets per booking" hint={`How many tickets one person can book at once (1 to ${LIMITS.maxPerBooking}).`} />
      </div>

      <section aria-labelledby="promo-h" className="space-y-4">
        <div>
          <h3 id="promo-h" className="font-display text-xl font-semibold">
            Promo codes <span className="font-sans text-base font-normal text-ink-faint">(optional)</span>
          </h3>
          <p className="text-sm text-ink-faint">Codes guests can enter for money off paid tickets.</p>
        </div>
        {promos.map((p, i) => (
          <FieldScope key={i} label={`Promo ${i + 1}`}>
            <div className="grid items-start gap-3 rounded-2xl border border-line bg-panel p-4 sm:grid-cols-[1fr_auto_8rem_auto]">
              <TextField form={form} name={`promoCodes.${i}.code`} label="Code" inputClassName="font-mono uppercase" autoCapitalize="characters" />
              <RadioGroupField
                form={form}
                name={`promoCodes.${i}.kind`}
                label="Type"
                variant="pills"
                options={[
                  { id: 'percent', label: '% off' },
                  { id: 'fixed', label: '₦ off' },
                ]}
              />
              <NumberField form={form} name={`promoCodes.${i}.value`} label={p.kind === 'percent' ? 'Percent' : 'Naira'} />
              <Button variant="danger" size="icon" className="sm:mt-7" onClick={() => removePromo(i)} aria-label={`Remove promo code ${p.code || i + 1}`}>
                <Icon name="trash" className="size-5" />
              </Button>
            </div>
          </FieldScope>
        ))}
        <Button id="add-promo" variant="outline" size="sm" onClick={addPromo}>
          <Icon name="plus" className="size-4" />
          Add a promo code
        </Button>
      </section>
    </div>
  )
}
