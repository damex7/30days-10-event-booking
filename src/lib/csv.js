/*
  CSV, the format Excel and Google Sheets open without asking questions.
  The rules that matter (RFC 4180, plus two practical ones):
    - a value containing a comma, quote or line break is wrapped in
      double quotes, and quotes inside it are doubled ("" );
    - rows end with CRLF;
    - the file starts with a UTF-8 BOM (﻿). Without it, Excel on
      Windows guesses the wrong encoding and "Dàyọ̀" and "₦" turn into
      garbage;
    - FORMULA INJECTION: a cell starting with = + - or @ is run as a
      formula by spreadsheet apps. A guest could type
      "=HYPERLINK(...)" as their name. We prefix such cells with an
      apostrophe, which makes the app show them as plain text.
      (That's also why phone numbers go out as 0803 123 4567, not +234….)
*/
function cell(value) {
  let text = value == null ? '' : String(value)
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

/** rows: arrays of values; the first row is the header. */
export function toCsv(rows) {
  return '﻿' + rows.map((row) => row.map(cell).join(',')).join('\r\n') + '\r\n'
}
