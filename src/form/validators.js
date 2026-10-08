import { normalisePhone } from '../lib/phone.js'

/*
  Validation rules as small pure functions.
  Each rule is made by a factory that takes the message, and returns a
  function (value) → message | undefined:

      const rule = required('Enter your name.')
      rule('')      → 'Enter your name.'
      rule('Ada')   → undefined

  check(value, ...rules) returns the FIRST failing message, so a field
  shows one problem at a time, the most basic first ("Enter your email"
  before "That doesn't look like an email").

  Every rule except `required` passes an empty value. Whether a field may
  be empty is required's job alone, which is what lets one `email` rule
  serve both required and optional fields.

  Messages say what to do, not just what's wrong:
  "Enter a Nigerian mobile number, like 0803 123 4567", not "Invalid phone".
*/

export const isBlank = (v) => v == null || (typeof v === 'string' && v.trim() === '') || (Array.isArray(v) && v.length === 0)

/** The first message from a list of rules, or undefined. Falsy entries are skipped, so rules can be conditional. */
export function check(value, ...rules) {
  for (const rule of rules) {
    const message = rule && rule(value)
    if (message) return message
  }
  return undefined
}

export const required = (message) => (v) => (isBlank(v) ? message : undefined)

export const EMAIL = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)*\.[a-z]{2,}$/i
export const email =
  (message = 'Enter an email address like name@example.com.') =>
  (v) =>
    isBlank(v) || EMAIL.test(String(v).trim()) ? undefined : message

export const ngPhone =
  (message = 'Enter a Nigerian mobile number, like 0803 123 4567 or +234 803 123 4567.') =>
  (v) =>
    isBlank(v) || normalisePhone(v) ? undefined : message

export const minLength = (n, message) => (v) => (isBlank(v) || String(v).trim().length >= n ? undefined : message)
export const maxLength = (n, message) => (v) => (isBlank(v) || String(v).trim().length <= n ? undefined : message)

/** Whole numbers only: "3" passes; "3.5", "three" and "1e3" don't. */
export const integer =
  (message = 'Enter a whole number, like 3.') =>
  (v) =>
    isBlank(v) || /^-?\d+$/.test(String(v).trim()) ? undefined : message

/** A number within a range. Either end can be null for "no limit". Run after integer(). */
export const between = (min, max, message) => (v) => {
  if (isBlank(v)) return undefined
  const n = Number(v)
  return (min != null && n < min) || (max != null && n > max) ? message : undefined
}

/*
  Dates as strings that sort correctly: "2026-11-14" (date inputs) or
  "2026-11-14T12:00" (datetime-local). Comparing those strings is the same
  as comparing the dates, and avoids time-zone surprises from new Date().
*/
export const notBefore = (earliest, message) => (v) => (isBlank(v) || !earliest || String(v) >= earliest ? undefined : message)

/** Cross-field: this value must come strictly after another field's value. */
export const after = (other, message) => (v) => (isBlank(v) || isBlank(other) || String(v) > String(other) ? undefined : message)

export const oneOf = (allowed, message) => (v) => (isBlank(v) || allowed.includes(v) ? undefined : message)

/** Multiple choice: how many may be picked. */
export const pickBetween =
  (min, max, { tooFew, tooMany }) =>
  (v) => {
    const count = Array.isArray(v) ? v.length : 0
    if (min != null && count > 0 && count < min) return tooFew
    if (max != null && count > max) return tooMany
    return undefined
  }

/** Add a message to an errors object only if there is one: errors stay { path: message } with no empty keys. */
export function collect(errors, path, message) {
  if (message) errors[path] = message
  return errors
}
