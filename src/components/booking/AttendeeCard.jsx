import { FieldScope } from '../../form/Field.jsx'
import { CheckboxField, TextField } from '../../form/controls.jsx'
import { Button } from '../ui/Button.jsx'
import { Icon } from '../ui/Icon.jsx'
import { QuestionList } from './Questions.jsx'

/*
  One guest: their ticket type, contact details and the per-guest
  questions. Guest 1 can be "me", in which case their details mirror the
  buyer's (read from values.buyer at save time, so they can't drift apart)
  and only the per-guest questions are asked.

  Everything is wrapped in a FieldScope, so the error summary says
  "Guest 2 · Email: …" instead of an ambiguous "Email: …".
*/
export function AttendeeCard({ form, event, index, onRemove, announce, preview }) {
  const values = form.values
  const guest = values.attendees[index]
  const ticket = event.tickets.find((t) => t.id === guest.ticketId)
  const isBuyer = index === 0 && values.firstIsBuyer
  const base = `attendees.${index}`
  const title = `Guest ${index + 1}`
  const headingId = form.idFor(`${base}.heading`)

  return (
    <FieldScope label={title}>
      <section aria-labelledby={headingId} className="rounded-2xl border border-line bg-panel p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 id={headingId} tabIndex={-1} className="font-display text-xl font-semibold">
              {title}
              {isBuyer && <span className="font-sans text-base font-normal text-ink-faint"> · you</span>}
            </h3>
            <p className="text-sm font-bold text-gele-ink">{ticket?.name ?? 'Ticket'}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => onRemove(index)} aria-label={`Remove ${title} (${ticket?.name ?? 'ticket'})`}>
            <Icon name="trash" className="size-4" />
            Remove
          </Button>
        </div>

        {index === 0 && (
          <CheckboxField
            id={form.idFor('firstIsBuyer')}
            className="mt-4 rounded-xl bg-panel-2 p-3"
            label="This guest is me"
            hint="Use the name, email and phone you gave above."
            checked={values.firstIsBuyer}
            onChange={(checked) => form.setValue('firstIsBuyer', checked)}
          />
        )}

        <div className="mt-4 space-y-5">
          {isBuyer ? (
            <p className="text-ink-soft">
              {values.buyer.name.trim() ? (
                <>
                  <span className="font-bold text-ink">{values.buyer.name}</span>
                  {values.buyer.email && ` · ${values.buyer.email}`}
                </>
              ) : (
                'Your details from above.'
              )}
            </p>
          ) : (
            <>
              <TextField form={form} name={`${base}.name`} label="Full name" autoComplete="off" hint="As it should appear on the ticket." />
              <div className="grid gap-5 sm:grid-cols-2">
                <TextField form={form} name={`${base}.email`} label="Email" type="email" inputMode="email" autoComplete="off" hint="Email, phone, or both." />
                <TextField form={form} name={`${base}.phone`} label="Phone" type="tel" inputMode="tel" autoComplete="off" hint="Like 0803 123 4567." />
              </div>
            </>
          )}

          <QuestionList
            form={form}
            questions={event.questions}
            scope="guest"
            bookingAnswers={values.answers}
            guestAnswers={guest.answers}
            basePath={`${base}.answers`}
            announce={(text) => announce(`${title}: ${text}`)}
            preview={preview}
          />
        </div>
      </section>
    </FieldScope>
  )
}
