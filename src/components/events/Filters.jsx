import { useEffect, useId, useRef, useState } from 'react'
import { Button } from '../ui/Button.jsx'
import { Icon } from '../ui/Icon.jsx'
import { CATEGORIES, CITIES } from '../../config.js'
import { cx } from '../../lib/cx.js'
import { controlClass, labelClass, pillClass, selectClass } from '../../form/styles.js'

export const FILTER_SPEC = {
  q: 'text',
  city: CITIES,
  category: CATEGORIES.map((c) => c.id),
  when: ['week', 'month'],
  price: ['free', 'paid'],
}

const WHEN = [
  { value: '', label: 'Any time' },
  { value: 'week', label: 'This week' },
  { value: 'month', label: 'This month' },
]
const PRICE = [
  { value: '', label: 'Any price' },
  { value: 'free', label: 'Free' },
  { value: 'paid', label: 'Paid' },
]

/** A row of radio pills inside a fieldset: arrow keys move between them, as with any radio group. */
function PillGroup({ legend, name, options, value, onChange }) {
  return (
    <fieldset>
      <legend className={labelClass}>{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <label key={o.value} className={pillClass('px-3.5')}>
            <input type="radio" name={name} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} className="sr-only" />
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  )
}

/*
  Search + filters. Every control writes straight to the URL (see
  useUrlFilters), except search: what you type is kept locally and sent to
  the URL 300ms after you stop, so each keystroke doesn't start a new
  request.
  On phones the four filters fold away behind a "Filters" button so the
  results aren't pushed off the first screen.
*/
export function Filters({ filters, setFilter, clearAll, activeCount }) {
  const ids = useId()
  const [open, setOpen] = useState(false)
  const [text, setText] = useState(filters.q)

  // When the URL changes from elsewhere (Clear, Back), show it in the box.
  const lastSent = useRef(filters.q)
  useEffect(() => {
    if (filters.q !== lastSent.current) {
      lastSent.current = filters.q
      setText(filters.q)
    }
  }, [filters.q])

  useEffect(() => {
    if (text === lastSent.current) return
    const timer = setTimeout(() => {
      lastSent.current = text
      setFilter('q', text.trim(), { replace: true })
    }, 300)
    return () => clearTimeout(timer)
  }, [text, setFilter])

  const filterCount = activeCount - (filters.q ? 1 : 0)

  return (
    <section aria-label="Search and filters" className="rounded-2xl bg-panel p-4 shadow-card ring-1 ring-line sm:p-5">
      <form role="search" onSubmit={(e) => e.preventDefault()} className="flex items-end gap-2">
        <div className="flex-1">
          <label htmlFor={`${ids}q`} className={labelClass}>
            Search events
          </label>
          <div className="relative">
            <Icon name="search" className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-ink-faint" />
            <input
              id={`${ids}q`}
              type="search"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Owambe, comedy, Yaba…"
              autoComplete="off"
              className={controlClass(false, 'h-12 pl-11')}
            />
          </div>
        </div>
        <Button variant="outline" className="h-12 md:hidden" aria-expanded={open} aria-controls={`${ids}panel`} onClick={() => setOpen((o) => !o)}>
          <Icon name="filter" className="size-4" />
          Filters{filterCount > 0 && ` (${filterCount})`}
        </Button>
      </form>

      <div id={`${ids}panel`} className={cx('mt-4 grid gap-4 md:grid md:grid-cols-2 lg:grid-cols-[1fr_1fr_auto_auto]', open ? 'grid' : 'hidden')}>
        <div>
          <label htmlFor={`${ids}city`} className={labelClass}>
            City
          </label>
          <select id={`${ids}city`} value={filters.city} onChange={(e) => setFilter('city', e.target.value)} className={selectClass(false)}>
            <option value="">All cities</option>
            {CITIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={`${ids}cat`} className={labelClass}>
            Category
          </label>
          <select id={`${ids}cat`} value={filters.category} onChange={(e) => setFilter('category', e.target.value)} className={selectClass(false)}>
            <option value="">All categories</option>
            {CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <PillGroup legend="When" name={`${ids}when`} options={WHEN} value={filters.when} onChange={(v) => setFilter('when', v)} />
        <PillGroup legend="Price" name={`${ids}price`} options={PRICE} value={filters.price} onChange={(v) => setFilter('price', v)} />
      </div>

      {activeCount > 0 && (
        <div className="mt-4 flex justify-end border-t border-line pt-3">
          <Button variant="ghost" size="sm" onClick={clearAll}>
            <Icon name="x" className="size-4" />
            Clear search and filters
          </Button>
        </div>
      )}
    </section>
  )
}
