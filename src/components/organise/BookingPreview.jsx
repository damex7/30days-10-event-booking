import { useMemo, useState } from 'react'
import { BookingForm, useBookingForm } from '../booking/BookingForm.jsx'
import { Button } from '../ui/Button.jsx'
import { Icon } from '../ui/Icon.jsx'
import { formToEvent } from '../../lib/eventRules.js'

/*
  The live preview: the REAL BookingForm, built from the editor's
  current (unsaved, maybe half-typed) values. Because it's the same
  component guests get, what the organiser sees is exactly what guests
  will see, conditions and validation included. Try answering "Yes" to
  aso-ebi here and the follow-up questions appear.

  formToEvent(..., { tolerant: true }) turns half-typed values into
  something renderable, and every ticket is shown as on sale with its full
  quantity: the preview is about the form, not today's availability.
*/
function previewEvent(values) {
  const event = formToEvent(values, { tolerant: true })
  return {
    ...event,
    tickets: event.tickets.map((t) => ({ ...t, sold: 0, remaining: t.quantity, onSale: true, status: 'available' })),
    bookable: true,
    soldOut: false,
  }
}

function PreviewForm({ event }) {
  const [checked, setChecked] = useState(false)
  const form = useBookingForm(event, { onSubmit: async () => setChecked(true) })
  return (
    <>
      {checked && form.isValid && (
        <p role="status" className="mb-4 flex items-center gap-2 rounded-xl bg-teal-soft p-3 text-sm font-bold text-teal-ink">
          <Icon name="check" className="size-4" /> Everything checks out. (Preview only: nothing was booked.)
        </p>
      )}
      <BookingForm form={form} event={event} preview />
    </>
  )
}

export function BookingPreview({ values }) {
  const event = useMemo(() => previewEvent(values), [values])
  const [round, setRound] = useState(0) // bump to start the preview form afresh

  return (
    <section aria-labelledby="preview-h" className="rounded-2xl border-2 border-dashed border-gold bg-paper p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 id="preview-h" className="flex items-center gap-2 font-display text-xl font-semibold">
            <Icon name="eye" className="size-5" />
            Guest’s view
          </h2>
          <p className="text-sm text-ink-faint">Live preview. Try it: nothing is saved.</p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setRound((n) => n + 1)}>
          <Icon name="retry" className="size-4" />
          Clear answers
        </Button>
      </div>
      <PreviewForm key={round} event={event} />
    </section>
  )
}
