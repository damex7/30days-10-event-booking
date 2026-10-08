/*
  Nigerian mobile numbers (from Day 9). They're 11 digits starting 070,
  071, 080, 081, 090 or 091 (0803 123 4567), or the same number with +234
  in place of the leading 0. People type them in many ways, so we strip
  spaces, dashes, dots and brackets, then accept:
    08031234567      0 + 10 digits
    +2348031234567   +234 + 10 digits
    2348031234567    234 + 10 digits (no plus)
    +23408031234567  +234 with the 0 kept by mistake (common!)
  Everything is stored in ONE format, +2348031234567 (E.164), so WhatsApp
  links, the CSV and the dashboard always agree.
*/
const LOCAL = /^0([789][01]\d{8})$/
const INTERNATIONAL = /^(?:\+?234)0?([789][01]\d{8})$/

export function normalisePhone(raw) {
  const compact = String(raw ?? '').replace(/[\s\-.()]/g, '')
  const match = compact.match(LOCAL) ?? compact.match(INTERNATIONAL)
  return match ? `+234${match[1]}` : null
}

/** +2348031234567 → "0803 123 4567", the way Nigerians write it. */
export function formatPhoneLocal(e164) {
  const m = String(e164 ?? '').match(/^\+234(\d{3})(\d{3})(\d{4})$/)
  return m ? `0${m[1]} ${m[2]} ${m[3]}` : String(e164 ?? '')
}
