import { useEffect, useRef, useState } from 'react'
import { Field } from '../../form/Field.jsx'
import { controlClass } from '../../form/styles.js'
import { appliedPromo, totalsFor } from '../../lib/bookingRules.js'
import { normaliseCode } from '../../lib/booking.js'
import { checkPromo } from '../../lib/db.js'
import { Button } from '../ui/Button.jsx'
import { Icon } from '../ui/Icon.jsx'

/*
  A promo code, checked by the "server" (with a delay, like a real API).

  The result lives in the form values (values.promo), and validateBooking
  turns it into an ordinary field error, so the async check needs no
  special error handling: "invalid code" shows inline, in the summary
  and blocks submit, like any other problem.

  Details that matter with async checks:
    - Enter in this box applies the code instead of submitting the whole
      booking.
    - A newer check cancels an older one (AbortController), and a result
      is ignored if the code was edited while it was checking. Otherwise a
      slow answer for "LAUGH2" could land after "LAUGH20" was typed.
    - "Checking…" is announced politely, and the result is revealed
      straight away: pressing Apply is a finished action, not half-typing.
*/
export function PromoField({ form, event, preview = false }) {
  const [checking, setChecking] = useState(false)
  const controller = useRef(null)
  const applied = appliedPromo(form.values)
  const typed = normaliseCode(form.values.promoCode)
  const id = form.idFor('promoCode')

  useEffect(() => () => controller.current?.abort(), [])

  // Reveal the result of a check as soon as it arrives (after the render that contains it).
  const [revealAfterCheck, setRevealAfterCheck] = useState(0)
  useEffect(() => {
    if (revealAfterCheck) form.touch('promoCode')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealAfterCheck])

  async function apply() {
    if (!typed) {
      form.setValue('promo', null)
      return
    }
    controller.current?.abort()
    const ctrl = new AbortController()
    controller.current = ctrl
    setChecking(true)
    try {
      if (preview) throw Object.assign(new Error('Promo codes are checked when guests book for real.'), { code: 'PROMO_INVALID' })
      const result = await checkPromo(event.id, typed, totalsFor(event, { ...form.values, promo: null }).subtotalKobo, { signal: ctrl.signal })
      form.setValues((v) => (normaliseCode(v.promoCode) === typed ? { ...v, promo: { status: 'applied', ...result } } : v))
    } catch (error) {
      if (error.name === 'AbortError') return
      const message = error.code === 'PROMO_INVALID' || preview ? error.message : 'We couldn’t check that code just now. Try again in a moment.'
      form.setValues((v) => (normaliseCode(v.promoCode) === typed ? { ...v, promo: { status: 'invalid', code: typed, message } } : v))
    } finally {
      if (controller.current === ctrl) {
        setChecking(false)
        setRevealAfterCheck((n) => n + 1)
      }
    }
  }

  function clear() {
    controller.current?.abort()
    setChecking(false)
    form.setValues((v) => ({ ...v, promoCode: '', promo: null }))
    document.getElementById(id)?.focus()
  }

  return (
    <Field form={form} name="promoCode" label="Promo code" optional hint="Got a code from the organiser? Enter it and press Apply.">
      {(a11y) => (
        <>
          <div className="flex gap-2">
            <input
              {...a11y}
              type="text"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              value={form.values.promoCode}
              onChange={(e) => form.setValue('promoCode', e.target.value.toUpperCase())}
              onBlur={form.blurHandler('promoCode')}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  apply()
                }
              }}
              className={controlClass(a11y['aria-invalid'], 'h-12 max-w-56 font-mono tracking-wider uppercase')}
            />
            {applied ? (
              <Button variant="outline" className="h-12" onClick={clear}>
                Remove
              </Button>
            ) : (
              <Button variant="secondary" className="h-12" onClick={apply} disabled={checking || !typed}>
                {checking ? 'Checking…' : 'Apply'}
              </Button>
            )}
          </div>
          <p aria-live="polite" className="mt-2 text-sm">
            {checking && <span className="text-ink-faint">Checking your code…</span>}
            {!checking && applied && (
              <span className="flex items-center gap-1.5 font-bold text-teal-ink">
                <Icon name="check" className="size-4" />
                {applied.code} applied: {applied.label}
              </span>
            )}
          </p>
        </>
      )}
    </Field>
  )
}
