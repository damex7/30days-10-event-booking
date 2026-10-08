import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'

/*
  Filters that live in the URL (?city=Lagos&when=week), so a filtered list
  can be bookmarked, shared on WhatsApp, and survives refresh and Back.

  `spec` says what each filter may hold:
    { q: 'text', city: ['Lagos', 'Abuja', ...] }
  The URL is user-editable, so a value that isn't allowed (?city=Narnia)
  is ignored rather than trusted. Empty values are removed from the URL,
  and other params (like ?fail=1) are left alone.
*/
export function useUrlFilters(spec) {
  const [params, setParams] = useSearchParams()

  const filters = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(spec).map(([key, allowed]) => {
          const raw = params.get(key) ?? ''
          return [key, allowed === 'text' ? raw.slice(0, 80) : allowed.includes(raw) ? raw : '']
        }),
      ),
    // spec is a constant defined outside the component
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [params],
  )

  /** Typing in a search box uses { replace: true }, so Back doesn't step through every letter. */
  const setFilter = useCallback(
    (key, value, { replace = false } = {}) =>
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          if (value) next.set(key, value)
          else next.delete(key)
          return next
        },
        { replace },
      ),
    [setParams],
  )

  const clearAll = useCallback(
    () =>
      setParams((prev) => {
        const next = new URLSearchParams(prev)
        for (const key of Object.keys(spec)) next.delete(key)
        return next
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [setParams],
  )

  const activeCount = Object.values(filters).filter(Boolean).length
  return { filters, setFilter, clearAll, activeCount }
}
