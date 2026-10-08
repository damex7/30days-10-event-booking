# Ìpè: event booking for Naija

**Day 10 of my 30-day challenge**, and the last day of the "React + APIs" phase. Today's focus: **forms and validation**.

Nigerian events run on WhatsApp threads and spreadsheets, especially owambes, where the host is also collecting aso-ebi colours and sizes from
200 aunties. Ìpè (Yoruba for a call or invitation) lets an organiser create an event with ticket types and **their own questions**, and guests book
through a form that is **generated from those questions**. The organiser then sees every booking, a summary of the answers (aso-ebi orders by
colour × size), and can export a CSV.

Built with Vite, React 19, Tailwind CSS v4 and react-router. **No form or validation library**: the form toolkit is written by hand in
[`src/form/`](src/form/).

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build in dist/
npm run preview  # serve the build
```

Deploys to Vercel as a static site. `vercel.json` rewrites every path to `index.html`, so refreshing `/organise/evt_owambe` works.

### Things to try

- **Book the owambe** and answer "Yes" to _Do you want aso-ebi?_ for a guest: colour, head piece and size appear. Switch to "No": they disappear,
  and their answers are neither validated nor saved.
- **Promo codes**: `LAUGH20` (20% off, comedy show), `LAGOSDEV` (50% off, JS meetup), `PARTNER2K` (₦2,000 off, conference).
- **Sold out**: _Afrobeats Under the Stars_ is fully booked (waitlist form); the comedy show's VIP is sold out and Regular is nearly gone.
- **Refresh half-way through a booking**: your answers come back. Click a link away: you're asked first.
- **Organise → Create an event → Questions → Add aso-ebi questions**, then try the live "Guest's view" next to it.
- **Dashboard → Cancel** a booking, then look at the event page: the places are free again.
- Add **`?fail=1`** to any URL to make every request fail (error states and Retry), or `?fail=0.5` for half of them.
- **Organise → Reset demo data** puts the six sample events back.

## Pages

| Route                         | What it does                                                                                     |
| ----------------------------- | ------------------------------------------------------------------------------------------------ |
| `/`                           | Browse events: search, city, category, this week / this month, free / paid. All filters in the URL |
| `/events/:slug`               | Event page: Lagos-time details, ticket types with spots left, Book, or the waitlist when sold out |
| `/events/:slug/book`          | **The generated booking form**                                                                   |
| `/bookings/:reference`        | Confirmation: reference, summary, Add to calendar (.ics), Share on WhatsApp                      |
| `/bookings/:reference/ticket` | Printable tickets, one per guest                                                                 |
| `/organise`                   | Your events, with how full each one is                                                           |
| `/organise/new`, `/:id/edit`  | The 4-step event editor and form builder, with a live preview                                    |
| `/organise/:id`               | Dashboard: sales, revenue, bookings table, answers, cross-tab, CSV export, cancel                |

## The form toolkit (`src/form/`)

Four small pieces instead of a library.

### 1. `validators.js`: rules as pure functions

Each rule is a function `value → message | undefined`, made by a factory that takes the message:

```js
check(email, required('Enter your email address.'), email()) // → first failing message, or undefined
```

Every rule except `required` lets an empty value pass, so one `email()` works for required and optional fields. Cross-field rules take the
other value: `after(values.startsAt, 'The end must be after the start.')`. Messages say **what to do** ("Enter a Nigerian mobile number, like 0803 123
4567"), not just "Invalid".

A form's `validate(values)` combines rules into `{ 'buyer.email': 'message', 'attendees.1.name': 'message' }`. Field names are **paths**
(`paths.js`), so one flat error object can describe deeply nested values like guests and their answers.

### 2. `useForm`: knowing errors vs showing them

```js
const form = useForm({ initialValues, validate, onSubmit })
<form {...form.formProps}>
  <TextField form={form} name="buyer.email" label="Email" type="email" />
</form>
```

`validate` runs on **every** change. It's pure and cheap, so the form always _knows_ every problem (`form.allErrors`). What it _shows_
(`form.errors`) follows "reward early, punish late":

1. While you type in a field with no error showing, nothing new appears. Nobody gets told "invalid email" at `ada@`.
2. When you **leave** a field (blur), its problem is revealed.
3. Once a field's error is showing, it updates **live**, and disappears the moment the value is valid. Then the field goes quiet again (rule 1).
4. **Submit** reveals everything, shows the error summary, and focuses the first problem.

The order of "first" comes from the page, not from object keys: every field's wrapper has `data-field="path"`, and `useForm` reads them in DOM order.
That matters in a form generated from config, where fields come and go. If `onSubmit` throws an error with `details` (the "server" said _Only 2 VIP
left_), those messages appear on the matching fields too.

### 3. `Field` and `controls.jsx`: accessibility wired once

`Field` renders the label (or a `<legend>` for radio and checkbox groups), the hint and the error, and gives the control `id`, `aria-describedby`
(hint + error) and `aria-invalid`. Hint and error sit **above** the input, because on a phone the keyboard hides whatever is below. Errors have an
icon, text and a thick left bar, so they don't rely on colour. `FieldScope` prefixes labels so the summary says "Guest 2 · Email: …".

The controls (`TextField`, `NumberField`, `DateField`, `SelectField`, `RadioGroupField`, `CheckboxGroupField`, `YesNoField`…) are native inputs, so
the keyboard, autofill and screen readers just work. Numbers use `inputMode="numeric"` instead of `type="number"`, which accepts `1e5` and changes
when you scroll.

### 4. `ErrorSummary`, `useDraft`, `useLeaveGuard`

- **ErrorSummary**: after a failed submit, a `role="alert"` box listing every problem as a link that focuses the field. It shrinks as you fix things.
  It also holds a polite live region that announces errors revealed on blur.
- **useDraft** saves values to localStorage 400ms after you stop typing. `loadDraft` reads them back once, **checked against the world as it is now**:
  answers to deleted questions are dropped, and guests for tickets that sold out meanwhile are removed (and you're told).
- **useLeaveGuard**: react-router's `useBlocker` for links inside the app (with our own dialog), plus `beforeunload` for refresh and closing the tab.
  This is why the app uses `createBrowserRouter`: `useBlocker` only works with a data router.

## The generated booking form

An event's custom questions are plain data:

```js
{
  id: 'q_size', label: 'Size', hint: 'UK dress sizes.',
  type: 'single',            // short | long | single | multi | number | date | yesno
  required: true,
  perAttendee: true,         // asked for each guest, or once per booking
  options: [{ id: 'o_m', label: 'M (12–14)' }, …],
  min: null, max: null,      // number range, or how many a multi-choice may pick
  notInPast: false,          // dates
  showIf: { questionId: 'q_asoebi', anyOf: ['yes'] },   // or null
}
```

[`QuestionField`](src/components/booking/Questions.jsx) is a `switch` on `type` that picks the control. That switch is the whole "form from config"
idea.

**Conditions** have one shape for every type: _show this question when the answer to `questionId` is any of `anyOf`_. Yes/no answers are `'yes'`/`'no'`,
single choice is an option id, and a multiple-choice answer matches if any ticked option is in the list. Rules (enforced by the editor, re-checked on
load):

- a question may only depend on an **earlier** question, so there are no loops and one pass in order works out what's visible;
- visibility is **chained**: if the parent is hidden, so is the child;
- a once-per-booking question can't depend on a per-guest one (which guest?).

**Hidden answers are kept but ignored.** If you pick "Gold", then switch aso-ebi to "No", "Gold" stays in the form's state (switch back and it's
still there), but `validateBooking` only looks at visible questions, and `pruneAnswers` drops hidden answers before anything is saved.

**Guests are the quantity.** There's no separate "quantity" value: 3 Regular guests _is_ 3 Regular tickets, so they can't disagree. The steppers add
or remove guests; removing a guest lowers the quantity.

**The "server" re-checks everything.** `db.createBooking` works out availability again from the bookings saved right now, runs the same
`validateBooking`, looks the promo code up itself, and takes prices from the event, never from the browser. One set of rules
([`bookingRules.js`](src/lib/bookingRules.js)) serves both.

## Data

There's no backend. [`src/lib/db.js`](src/lib/db.js) is a pretend server over localStorage, with async functions (`getEvents`, `getEvent`,
`createBooking`, `checkPromo`, `createEvent`, `updateEvent`, `getBookings`, `cancelBooking`, `joinWaitlist`…) and a 300–700ms delay. It re-reads and
**re-validates** storage on every call ([`schema.js`](src/lib/schema.js) drops or repairs anything malformed), returns copies, and throws `ApiError`s.
Swapping it for `fetch()` calls later wouldn't change any page.

- **Spots left are never stored.** They're counted from confirmed bookings each time, so cancelling a booking frees its places with no extra code.
- **Money is in kobo** (integers), as on Day 9. `formatNaira` is the only place it becomes "₦15,000".
- **Times are stored in UTC and shown in Lagos time** with `Intl.DateTimeFormat(…, { timeZone: 'Africa/Lagos' })`. Lagos has no daylight saving,
  so a `datetime-local` value becomes an instant by adding `+01:00`.
- The six seed events are dated **relative to the day you first open the app**, so "This week" always has something in it.

## Demo-only (not real)

- No payments: "Confirm booking" just saves. No emails or SMS are sent.
- No accounts: everyone is the organiser of every event in their browser.
- Data lives in this browser's localStorage. Another browser or device sees the seed data.
- Drafts are kept in localStorage for 7 days. On a shared computer, someone else could see a half-finished booking; a real app would tie drafts to an account.
- Promo codes are hidden from public event data, but in a browser-only app anyone with DevTools can read localStorage.
- Two people can still book "the last seat" in two tabs at the same moment. A real server needs a transaction to prevent that.
- No QR codes on tickets (that's Day 22).

## Where each concept lives

| Concept                                                     | File                                                                                                                                  |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Form state, reveal-on-blur, submit, focus first error       | [`src/form/useForm.js`](src/form/useForm.js)                                                                                          |
| Validation rules as pure functions                          | [`src/form/validators.js`](src/form/validators.js)                                                                                    |
| Nested values by path (`attendees.2.answers.q_size`)        | [`src/form/paths.js`](src/form/paths.js)                                                                                              |
| Label, hint, error and `aria-describedby` wiring            | [`src/form/Field.jsx`](src/form/Field.jsx)                                                                                            |
| Text, number, date, select, radio, checkbox, yes/no         | [`src/form/controls.jsx`](src/form/controls.jsx)                                                                                      |
| Error summary and screen-reader announcements               | [`src/form/ErrorSummary.jsx`](src/form/ErrorSummary.jsx)                                                                              |
| Saving and restoring drafts                                 | [`src/form/useDraft.js`](src/form/useDraft.js)                                                                                        |
| "Leave with unsaved changes?"                               | [`src/form/useLeaveGuard.jsx`](src/form/useLeaveGuard.jsx)                                                                            |
| Question types, conditions, visibility, pruning hidden answers | [`src/lib/questions.js`](src/lib/questions.js)                                                                                     |
| Booking validation (shared by form and "server"), drafts    | [`src/lib/bookingRules.js`](src/lib/bookingRules.js)                                                                                  |
| Spots left, guests ⇄ quantities, totals, promos             | [`src/lib/booking.js`](src/lib/booking.js)                                                                                            |
| The form generated from config                              | [`src/components/booking/BookingForm.jsx`](src/components/booking/BookingForm.jsx), [`Questions.jsx`](src/components/booking/Questions.jsx) |
| Async promo code check (stale results ignored)              | [`src/components/booking/PromoField.jsx`](src/components/booking/PromoField.jsx)                                                      |
| Dynamic guests, "This guest is me"                          | [`src/components/booking/AttendeeCard.jsx`](src/components/booking/AttendeeCard.jsx), [`TicketPicker.jsx`](src/components/booking/TicketPicker.jsx) |
| Event editor rules, step-by-step validation                 | [`src/lib/eventRules.js`](src/lib/eventRules.js)                                                                                      |
| Multi-step editor (step in the URL)                         | [`src/pages/EventEditor.jsx`](src/pages/EventEditor.jsx)                                                                              |
| Form builder: add, edit, reorder, delete, "show only if"    | [`src/components/organise/QuestionsStep.jsx`](src/components/organise/QuestionsStep.jsx)                                              |
| Keyboard reordering (Move up / down)                        | [`src/components/organise/ListItemActions.jsx`](src/components/organise/ListItemActions.jsx)                                          |
| Live preview of the booking form                            | [`src/components/organise/BookingPreview.jsx`](src/components/organise/BookingPreview.jsx)                                            |
| Pretend server, delays, `?fail=`                            | [`src/lib/db.js`](src/lib/db.js)                                                                                                      |
| Checking saved data before trusting it                      | [`src/lib/schema.js`](src/lib/schema.js)                                                                                              |
| Seed events and generated bookings                          | [`src/lib/seed.js`](src/lib/seed.js)                                                                                                  |
| Lagos time, "this week", datetime-local ⇄ UTC               | [`src/lib/dates.js`](src/lib/dates.js)                                                                                                |
| Money in kobo                                               | [`src/lib/money.js`](src/lib/money.js)                                                                                                |
| Nigerian phone numbers                                      | [`src/lib/phone.js`](src/lib/phone.js)                                                                                                |
| Filters in the URL                                          | [`src/hooks/useUrlFilters.js`](src/hooks/useUrlFilters.js)                                                                            |
| Loading / error / empty states                              | [`src/hooks/useAsync.js`](src/hooks/useAsync.js), [`src/components/ui/States.jsx`](src/components/ui/States.jsx)                      |
| Add to calendar (.ics)                                      | [`src/lib/ics.js`](src/lib/ics.js)                                                                                                    |
| CSV export (BOM, quoting, formula injection)                | [`src/lib/csv.js`](src/lib/csv.js), [`src/lib/stats.js`](src/lib/stats.js)                                                            |
| Dashboard numbers, answer summary, cross-tab                | [`src/lib/stats.js`](src/lib/stats.js), [`src/components/organise/DashboardParts.jsx`](src/components/organise/DashboardParts.jsx)    |
| Printable tickets                                           | [`src/pages/PrintTicket.jsx`](src/pages/PrintTicket.jsx), `@media print` in [`src/index.css`](src/index.css)                           |
| Design tokens, dark mode, lace pattern                      | [`src/index.css`](src/index.css)                                                                                                      |

## What React Hook Form + Zod would do for me

Writing this by hand was the point of today, but in a real project I'd likely reach for them. Roughly:

- **React Hook Form** replaces `useForm`. It keeps values in the inputs themselves (uncontrolled), so typing in one field doesn't re-render the
  whole form. That matters for a 60-field guest list, and here every keystroke re-renders the booking form. It has `mode: 'onTouched'` and
  `reValidateMode: 'onChange'`, which is the same reveal-on-blur-then-live behaviour I built. `useFieldArray` handles the add/remove/move lists
  (guests, tickets, options) with stable keys. `setFocus`, `setError` for server errors, and `shouldUnregister: true` (drop hidden fields' values) are
  built in.
- **Zod** replaces `validators.js` and `bookingRules.js` with a **schema**: `z.object({ email: z.string().email() })`. One schema can parse the form,
  check API responses, check localStorage (my `schema.js`), and with TypeScript give you the types for free. `superRefine` covers cross-field rules,
  and `z.discriminatedUnion` fits "the rules depend on the question type". A schema for a form generated at runtime is built from the config, the same
  way `validateBooking` loops over `event.questions`.
- **What they don't do for you:** the error summary, aria wiring, draft saving, the leave warning, the conditional-question logic and "the server
  checks again". Those are design decisions, and they'd stay much the same.

## Worth adding next

A real API with transactions (no double-booking the last seat), organiser accounts and roles (co-hosts), payments (Paystack, in kobo already),
emailed and WhatsApp-delivered tickets, QR check-in at the gate (Day 22), image uploads for covers, conditions on numbers ("if children > 0, ask their
ages"), per-ticket questions ("T-shirt size for Supporter tickets only"), editable bookings for guests, refunds, and tests for the pure rule modules
(`bookingRules`, `eventRules`, `questions`, `ics`, `csv` are easy to unit-test).
