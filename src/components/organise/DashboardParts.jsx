import { useId, useState } from 'react'
import { labelClass, selectClass } from '../../form/styles.js'
import { cx } from '../../lib/cx.js'
import { formatNaira } from '../../lib/money.js'
import { hasOptions, typeLabel } from '../../lib/questions.js'
import { crossTab } from '../../lib/stats.js'
import { Badge } from '../ui/Badge.jsx'

/*
  Dashboard building blocks. The charts here are deliberately plain:
  one measure each, one colour (the gele magenta) for every bar, the value
  written next to the bar in text ink, and a real <table> wherever there's
  a grid of numbers. Nothing is encoded in colour alone.
*/

/** A number with a label. Values use the body sans (not the display serif) so digits read cleanly. */
export function StatTile({ label, value, detail }) {
  return (
    <div className="rounded-2xl bg-panel p-4 ring-1 ring-line">
      <p className="text-sm text-ink-soft">{label}</p>
      <p className="mt-1 text-3xl font-semibold tracking-tight">{value}</p>
      {detail && <p className="mt-0.5 text-sm text-ink-faint">{detail}</p>}
    </div>
  )
}

/**
 * Horizontal bars for one measure. Bars are thin (12px), grow from one
 * baseline, and are rounded only at the data end. `max` sets the scale
 * (the biggest count); an item's own `max` overrides it (a ticket's quantity).
 * Each row is a list item whose text says everything the bar shows.
 */
export function BarList({ items, max, valueText }) {
  return (
    <ul className="space-y-3">
      {items.map((item) => {
        const scale = item.max ?? max
        const pct = scale > 0 ? Math.min(100, (item.value / scale) * 100) : 0
        return (
          <li key={item.id}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="font-semibold">{item.label}</span>
              <span className="shrink-0 text-ink-soft tabular-nums">{valueText(item)}</span>
            </div>
            <div aria-hidden="true" className="mt-1 h-3 rounded-r-[4px] bg-panel-2">
              <div className="h-full rounded-r-[4px] bg-gele" style={{ width: `${pct}%`, minWidth: item.value > 0 ? 3 : 0 }} />
            </div>
          </li>
        )
      })}
    </ul>
  )
}

/** Tickets sold per type. Each bar is scaled to its own ticket's quantity, so a full bar means sold out. */
export function SalesByType({ summary }) {
  return (
    <BarList
      items={summary.tickets.map((t) => ({ id: t.id, label: t.name, value: t.sold, max: t.quantity, ticket: t }))}
      valueText={({ ticket: t }) =>
        `${t.sold.toLocaleString('en-NG')} of ${t.quantity.toLocaleString('en-NG')}${t.priceKobo > 0 ? ` · ${formatNaira(t.revenueKobo)}` : ''}`
      }
    />
  )
}

/** One question's answers, summarised by type. */
function QuestionSummary({ summary: s }) {
  const [showAll, setShowAll] = useState(false)
  const per = s.asked === 'guests' ? 'guests' : 'bookings'
  return (
    <section className="rounded-2xl bg-panel p-4 ring-1 ring-line">
      <h3 className="font-bold">{s.question.label}</h3>
      <p className="mb-3 flex flex-wrap items-center gap-1.5 text-sm text-ink-faint">
        <Badge>{typeLabel(s.question.type)}</Badge>
        {s.answered} {s.answered === 1 ? per.slice(0, -1) : per} answered
        {s.question.showIf && ' (shown to some guests only)'}
      </p>
      {s.kind === 'choice' && (
        <BarList
          items={s.options.map((o) => ({ id: o.id, label: o.label, value: o.count }))}
          max={Math.max(1, ...s.options.map((o) => o.count))}
          valueText={(o) => `${o.value}${s.answered ? ` · ${Math.round((o.value / s.answered) * 100)}%` : ''}`}
        />
      )}
      {s.kind === 'number' && (
        <p className="text-sm">
          Total <span className="text-xl font-semibold">{s.total.toLocaleString('en-NG')}</span>
          {s.answered > 0 && <span className="text-ink-faint"> · average {s.average.toFixed(1)}</span>}
        </p>
      )}
      {s.kind === 'text' &&
        (s.answers.length === 0 ? (
          <p className="text-sm text-ink-faint">No answers yet.</p>
        ) : (
          <>
            <ul className="divide-y divide-line text-sm">
              {(showAll ? s.answers : s.answers.slice(0, 5)).map((a, i) => (
                <li key={i} className="py-1.5">
                  “{a.text}” <span className="text-ink-faint">· {a.who}</span>
                </li>
              ))}
            </ul>
            {s.answers.length > 5 && (
              <button
                type="button"
                className="mt-2 text-sm font-bold text-gele-ink underline underline-offset-2"
                onClick={() => setShowAll((v) => !v)}
                aria-expanded={showAll}
              >
                {showAll ? 'Show fewer' : `Show all ${s.answers.length}`}
              </button>
            )}
          </>
        ))}
    </section>
  )
}

export function AnswerSummary({ summaries }) {
  if (summaries.length === 0) return <p className="text-ink-faint">This event doesn’t ask any questions of its own.</p>
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {summaries.map((s) => (
        <QuestionSummary key={s.question.id} summary={s} />
      ))}
    </div>
  )
}

/*
  Cross-tab: two choice questions against each other. For an owambe,
  Aso-ebi colour × Size is the tailor's order. A real table (row and
  column headers, a caption) so it reads properly with a screen reader,
  and numbers in tabular figures so the columns line up.
*/
export function CrossTab({ event, bookings, initial }) {
  const ids = useId()
  const choiceQs = event.questions.filter(hasOptions)
  const [rowId, setRowId] = useState(initial?.[0] ?? '')
  const [colId, setColId] = useState(initial?.[1] ?? '')
  if (choiceQs.length < 2) return null
  const table = rowId && colId && rowId !== colId ? crossTab(event, bookings, rowId, colId) : null
  const max = table ? Math.max(1, ...table.counts.flat()) : 1

  return (
    <div className="rounded-2xl bg-panel p-4 ring-1 ring-line sm:p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        {[
          ['Rows', rowId, setRowId, 'r'],
          ['Columns', colId, setColId, 'c'],
        ].map(([label, value, set, key]) => (
          <div key={key}>
            <label htmlFor={`${ids}${key}`} className={labelClass}>
              {label}
            </label>
            <select id={`${ids}${key}`} value={value} onChange={(e) => set(e.target.value)} className={selectClass(false)}>
              <option value="">Choose a question…</option>
              {choiceQs.map((q) => (
                <option key={q.id} value={q.id}>
                  {q.label}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>

      {rowId && rowId === colId && <p className="mt-4 text-sm text-ink-faint">Choose two different questions.</p>}
      {table && (
        <div className="relative mt-5 overflow-x-auto" tabIndex={0} role="region" aria-label={`${table.rowQ.label} by ${table.colQ.label}`}>
          <table className="w-full min-w-max border-collapse text-sm tabular-nums">
            <caption className="mb-2 text-left text-ink-soft">
              {table.rowQ.label} × {table.colQ.label}: {table.total} {table.perGuest ? 'guests' : 'bookings'} answered both.
            </caption>
            <thead>
              <tr className="border-b border-line-strong">
                <th scope="col" className="py-2 pr-3 text-left font-bold text-ink-soft">
                  <span className="sr-only">{table.rowQ.label}</span>
                </th>
                {table.cols.map((c) => (
                  <th key={c.id} scope="col" className="px-2 py-2 text-right font-bold">
                    {c.label}
                  </th>
                ))}
                <th scope="col" className="py-2 pl-3 text-right font-bold">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {table.rows.map((r, ri) => (
                <tr key={r.id} className="border-b border-line">
                  <th scope="row" className="py-2 pr-3 text-left font-semibold">
                    {r.label}
                  </th>
                  {table.counts[ri].map((n, ci) => (
                    // A light wash of one hue, stronger for bigger counts: a heat-map hint. The number is always written.
                    <td
                      key={ci}
                      className="px-2 py-2 text-right"
                      style={{ backgroundColor: n ? `color-mix(in oklab, var(--color-gele) ${Math.round((n / max) * 28)}%, transparent)` : undefined }}
                    >
                      {n}
                    </td>
                  ))}
                  <td className="py-2 pl-3 text-right font-bold">{table.rowTotals[ri]}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row" className="py-2 pr-3 text-left font-bold">
                  Total
                </th>
                {table.colTotals.map((n, ci) => (
                  <td key={ci} className="px-2 py-2 text-right font-bold">
                    {n}
                  </td>
                ))}
                <td className={cx('py-2 pl-3 text-right font-bold')}>{table.total}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}
