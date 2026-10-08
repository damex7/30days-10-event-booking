/*
  MONEY RULE (same as Day 9): every amount is a whole number of KOBO.
  ₦1 = 100 kobo. We only turn kobo into "₦15,000" when printing it.

  JavaScript numbers are binary floating point and can't store most decimal
  fractions exactly (0.1 + 0.2 → 0.30000000000000004), so a total kept in
  naira with decimals can end up a kobo off. Integers add and multiply
  exactly, so we store kobo and round ONCE, on purpose, where a percentage
  could create a fraction (percentOf below).
*/

/** True for a valid money amount: a whole, non-negative number of kobo. */
export const isKobo = (v) => Number.isSafeInteger(v) && v >= 0

/** Whole naira (what an organiser types in a price field) to kobo. */
export const nairaToKobo = (naira) => Math.round(Number(naira)) * 100

/** Kobo to whole naira, for filling a price field (drops any kobo). */
export const koboToWholeNaira = (kobo) => Math.floor(kobo / 100)

/** A percentage of an amount, rounded to the nearest kobo. The only place percentages become money. */
export const percentOf = (kobo, percent) => Math.round((kobo * percent) / 100)

/** Add up amounts. Integers in, integer out. */
export const sumKobo = (amounts) => amounts.reduce((total, k) => total + k, 0)

const whole = new Intl.NumberFormat('en-NG', {
  style: 'currency',
  currency: 'NGN',
  currencyDisplay: 'narrowSymbol', // "₦", not "NGN"
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})
const withKobo = new Intl.NumberFormat('en-NG', {
  style: 'currency',
  currency: 'NGN',
  currencyDisplay: 'narrowSymbol',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/** The only place kobo becomes text. Whole-naira amounts drop the ".00". Discounts get a real minus: −₦2,000. */
export function formatNaira(kobo) {
  if (!Number.isFinite(kobo)) return '₦—'
  const abs = Math.abs(kobo)
  const text = (abs % 100 === 0 ? whole : withKobo).format(abs / 100)
  return kobo < 0 ? `−${text}` : text
}

/** Ticket prices: ₦0 reads as "Free". */
export const formatPrice = (kobo) => (kobo === 0 ? 'Free' : formatNaira(kobo))
