import { formatNaira } from '../../lib/money.js'
import { cx } from '../../lib/cx.js'

/*
  The order: one line per ticket type, the discount, and the total.
  Every number comes from computeTotals() in kobo; formatNaira() only
  turns the final integers into text.
*/
export function OrderSummary({ totals, className }) {
  if (totals.count === 0) return <p className={cx('text-ink-faint', className)}>No tickets chosen yet.</p>
  return (
    <dl className={cx('space-y-2', className)}>
      {totals.items.map((item) => (
        <div key={item.ticketId} className="flex justify-between gap-3">
          <dt>
            {item.quantity} × {item.name}
          </dt>
          <dd className="font-semibold">{item.lineKobo === 0 ? 'Free' : formatNaira(item.lineKobo)}</dd>
        </div>
      ))}
      {totals.discountKobo > 0 && (
        <div className="flex justify-between gap-3 text-teal-ink">
          <dt>Promo discount</dt>
          <dd className="font-semibold">{formatNaira(-totals.discountKobo)}</dd>
        </div>
      )}
      <div className="flex justify-between gap-3 border-t border-line pt-2 text-lg">
        <dt className="font-bold">Total</dt>
        <dd className={totals.totalKobo === 0 ? 'font-bold text-teal-ink' : 'font-display font-bold'}>{totals.totalKobo === 0 ? 'Free' : formatNaira(totals.totalKobo)}</dd>
      </div>
    </dl>
  )
}
