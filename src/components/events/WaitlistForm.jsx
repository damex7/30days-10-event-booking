import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '../ui/Button.jsx'
import { Icon } from '../ui/Icon.jsx'
import { ErrorSummary } from '../../form/ErrorSummary.jsx'
import { SelectField, TextField } from '../../form/controls.jsx'
import { useForm } from '../../form/useForm.js'
import { contactErrors } from '../../lib/bookingRules.js'
import { joinWaitlist } from '../../lib/db.js'
import { normalisePhone } from '../../lib/phone.js'

/*
  "Join the waitlist" for a sold-out event or ticket type. The smallest
  form in the app, and a good first read of the toolkit: values,
  a pure validate(), fields by path, an error summary, and onSubmit.
*/
export function WaitlistForm({ event, ticketId = '' }) {
  const soldOut = event.tickets.filter((t) => t.status === 'soldout')
  const [joined, setJoined] = useState(null)
  const doneRef = useRef(null)

  const validate = useCallback((v) => contactErrors(v, '', { who: 'your' }), [])
  const form = useForm({
    initialValues: { name: '', email: '', phone: '', ticketId },
    validate,
    onSubmit: async (v) => {
      const entry = await joinWaitlist(event.id, {
        name: v.name.trim(),
        email: v.email.trim(),
        phone: normalisePhone(v.phone) ?? '',
        ticketId: v.ticketId || null,
      })
      setJoined(entry)
    },
  })

  // Move focus to the confirmation, so screen-reader and keyboard users know it worked.
  useEffect(() => {
    if (joined) doneRef.current?.focus()
  }, [joined])

  if (joined) {
    return (
      <div ref={doneRef} tabIndex={-1} role="status" className="rounded-xl bg-teal-soft p-4 text-teal-ink outline-none">
        <p className="flex items-center gap-2 font-bold">
          <Icon name="check" className="size-5" /> You’re on the waitlist, {joined.name.split(' ')[0]}.
        </p>
        <p className="mt-1 text-sm">If a place opens up, the organiser will contact you {joined.email ? `at ${joined.email}` : 'by phone'}.</p>
      </div>
    )
  }

  return (
    <form {...form.formProps} className="space-y-4">
      <ErrorSummary form={form} />
      {soldOut.length > 1 && (
        <SelectField
          form={form}
          name="ticketId"
          label="Which ticket?"
          options={soldOut.map((t) => ({ id: t.id, label: t.name }))}
          placeholder="Any ticket"
          optional
        />
      )}
      <TextField form={form} name="name" label="Full name" autoComplete="name" />
      <TextField form={form} name="email" label="Email" type="email" autoComplete="email" inputMode="email" hint="Give an email, a phone number, or both." />
      <TextField form={form} name="phone" label="Phone" type="tel" autoComplete="tel" inputMode="tel" hint="A Nigerian mobile, like 0803 123 4567." />
      <Button type="submit" variant="secondary" className="w-full" disabled={form.isSubmitting}>
        <Icon name="bell" className="size-4" />
        {form.isSubmitting ? 'Adding you…' : 'Join the waitlist'}
      </Button>
    </form>
  )
}
