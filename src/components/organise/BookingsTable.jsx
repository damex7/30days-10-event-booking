import { useId, useState } from 'react'
import { Link } from 'react-router-dom'
import { controlClass, labelClass, pillClass } from '../../form/styles.js'
import { useUrlFilters } from '../../hooks/useUrlFilters.js'
import { formatDateTime } from '../../lib/dates.js'
import { formatNaira } from '../../lib/money.js'
import { formatPhoneLocal } from '../../lib/phone.js'
import { Badge } from '../ui/Badge.jsx'
import { Button } from '../ui/Button.jsx'
import { Icon } from '../ui/Icon.jsx'

const SPEC = { q: 'text', sort: ['name', 'tickets', 'total', 'oldest'], status: ['confirmed', 'cancelled'] }
const PAGE = 20

const COLUMNS = [
  { id: 'name', label: 'Booked by' },
  { id: 'tickets', label: 'Tickets' },
  { id: 'total', label: 'Total' },
  { id: 'date', label: 'Booked' },
]

const fold = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()

/*
  Every booking, with search, sort and a status filter, all kept in the
  URL (?q=ngozi&sort=name&status=cancelled), so a refresh or a shared
  link shows the same view.
  Sortable column headers are buttons inside <th>, and the sorted column
  says so with aria-sort. On a phone the table scrolls sideways inside a
  focusable region, so the page itself never scrolls sideways.
*/
export function BookingsTable({ bookings, onCancel }) {
  const ids = useId()
  const { filters, setFilter } = useUrlFilters(SPEC)
  const [shown, setShown] = useState(PAGE)
  const sort = filters.sort || 'date' // newest first by default

  const words = fold(filters.q).split(/\s+/).filter(Boolean)
  const rows = bookings
    .filter((b) => !filters.status || b.status === filters.status)
    .filter((b) => {
      if (!words.length) return true
      const text = fold([b.reference, b.buyer.name, b.buyer.email, b.buyer.phone, formatPhoneLocal(b.buyer.phone), ...b.attendees.map((a) => a.name)].join(' '))
      return words.every((w) => text.includes(w))
    })
    .map((b) => ({ ...b, count: b.attendees.length }))
    .sort((a, b) => {
      if (sort === 'name') return a.buyer.name.localeCompare(b.buyer.name)
      if (sort === 'tickets') return b.count - a.count
      if (sort === 'total') return b.totalKobo - a.totalKobo
      if (sort === 'oldest') return a.createdAt.localeCompare(b.createdAt)
      return b.createdAt.localeCompare(a.createdAt)
    })

  const sortFor = (col) => {
    if (col === 'date') return sort === 'date' ? 'oldest' : '' // newest ⇄ oldest
    return sort === col ? '' : col
  }
  const ariaSort = (col) => {
    if (col === 'date') return sort === 'date' ? 'descending' : sort === 'oldest' ? 'ascending' : 'none'
    if (sort !== col) return 'none'
    return col === 'name' ? 'ascending' : 'descending'
  }

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label htmlFor={`${ids}q`} className={labelClass}>
            Search bookings
          </label>
          <input
            id={`${ids}q`}
            type="search"
            value={filters.q}
            onChange={(e) => {
              setFilter('q', e.target.value, { replace: true })
              setShown(PAGE)
            }}
            placeholder="Name, email, phone or reference"
            className={controlClass(false, 'h-12')}
          />
        </div>
        <fieldset>
          <legend className={labelClass}>Status</legend>
          <div className="flex flex-wrap gap-2">
            {[
              ['', 'All'],
              ['confirmed', 'Confirmed'],
              ['cancelled', 'Cancelled'],
            ].map(([value, label]) => (
              <label key={value} className={pillClass()}>
                <input type="radio" name={`${ids}status`} checked={filters.status === value} onChange={() => setFilter('status', value)} className="sr-only" />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      <p role="status" className="mt-4 text-sm font-bold text-ink-soft">
        {rows.length === 1 ? '1 booking' : `${rows.length} bookings`}
        {filters.q && ` matching “${filters.q}”`}
      </p>

      {rows.length === 0 ? (
        <p className="mt-3 rounded-2xl border border-dashed border-line-strong p-6 text-center text-ink-faint">
          {bookings.length === 0 ? 'No bookings yet. Share your event link to get started.' : 'No bookings match. Try a different search or status.'}
        </p>
      ) : (
        <div className="relative mt-3 overflow-x-auto rounded-2xl ring-1 ring-line" tabIndex={0} role="region" aria-label="Bookings table">
          <table className="w-full min-w-[720px] border-collapse bg-panel text-sm">
            <thead className="bg-panel-2 text-left">
              <tr>
                <th scope="col" className="px-4 py-3 font-bold">
                  Reference
                </th>
                {COLUMNS.map((c) => (
                  <th key={c.id} scope="col" aria-sort={ariaSort(c.id)} className={`px-4 py-1 font-bold ${c.id === 'total' || c.id === 'tickets' ? 'text-right' : ''}`}>
                    <button type="button" onClick={() => setFilter('sort', sortFor(c.id))} className="inline-flex min-h-10 items-center gap-1 rounded hover:text-gele-ink">
                      {c.label}
                      <Icon name={ariaSort(c.id) === 'none' ? 'sort' : ariaSort(c.id) === 'ascending' ? 'up' : 'down'} className="size-4" />
                    </button>
                  </th>
                ))}
                <th scope="col" className="px-4 py-3 font-bold">
                  Status
                </th>
                <th scope="col" className="px-4 py-3">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.slice(0, shown).map((b) => (
                <tr key={b.id} className={b.status === 'cancelled' ? 'text-ink-faint' : ''}>
                  <td className="px-4 py-3 font-mono whitespace-nowrap">
                    <Link to={`/bookings/${b.reference}`} className="font-semibold text-gele-ink underline underline-offset-2">
                      {b.reference}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-ink">{b.buyer.name}</p>
                    <p className="text-xs">{[b.buyer.email, formatPhoneLocal(b.buyer.phone)].filter(Boolean).join(' · ')}</p>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {b.items.map((i) => (
                      <p key={i.ticketId}>
                        {i.quantity} × {i.name}
                      </p>
                    ))}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap tabular-nums">{b.totalKobo === 0 ? 'Free' : formatNaira(b.totalKobo)}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{formatDateTime(b.createdAt)}</td>
                  <td className="px-4 py-3">{b.status === 'confirmed' ? <Badge tone="teal">Confirmed</Badge> : <Badge>Cancelled</Badge>}</td>
                  <td className="px-4 py-2 text-right">
                    {b.status === 'confirmed' && (
                      <Button variant="danger" size="sm" onClick={() => onCancel(b)}>
                        Cancel<span className="sr-only"> booking {b.reference}</span>
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {rows.length > shown && (
        <Button variant="outline" className="mt-4" onClick={() => setShown((n) => n + PAGE)}>
          Show {Math.min(PAGE, rows.length - shown)} more
        </Button>
      )}
    </div>
  )
}
