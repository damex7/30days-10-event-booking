import { check, collect, email, maxLength, ngPhone, required } from '../form/validators.js'

/*
  Validation rules for bookings, as pure functions of the values.
  The SAME functions run in the browser (through useForm, for instant
  feedback) and in db.js before a booking is saved (the "server" check),
  so there's exactly one definition of a valid booking.
*/

/**
 * A person's contact details at `base` ("buyer", "attendees.1", "").
 * Buyers give name, email AND phone. Other guests give a name and at least
 * one way to reach them: plenty of aunties are on WhatsApp but don't use
 * email, and making them invent an address helps nobody. That's a
 * cross-field rule: the error sits on email, and clears as soon as either
 * field is filled.
 */
export function contactErrors(person = {}, base, { needBoth = false, who = 'your' } = {}) {
  const errors = {}
  const p = base ? `${base}.` : ''
  const yours = who === 'your'
  collect(
    errors,
    `${p}name`,
    check(person.name, required(yours ? 'Enter your full name.' : 'Enter this guest’s name, as it should appear on their ticket.'), maxLength(80, 'Keep the name under 80 characters.')),
  )
  const noEmail = !String(person.email ?? '').trim()
  const noPhone = !String(person.phone ?? '').trim()
  if (needBoth) {
    collect(errors, `${p}email`, check(person.email, required('Enter your email address. Your tickets are sent there.'), email()))
    collect(errors, `${p}phone`, check(person.phone, required('Enter your phone number, in case the organiser needs to reach you.'), ngPhone()))
  } else {
    collect(errors, `${p}email`, noEmail && noPhone ? (yours ? 'Enter an email address or a phone number, so we can reach you.' : 'Enter an email address or a phone number for this guest.') : check(person.email, email()))
    collect(errors, `${p}phone`, check(person.phone, ngPhone()))
  }
  return errors
}
