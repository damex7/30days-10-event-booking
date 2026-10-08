import { CATEGORIES, CITIES, COVER_PATTERNS, COVER_TONES } from '../../config.js'
import { DateTimeField, RadioGroupField, SelectField, TextAreaField, TextField } from '../../form/controls.jsx'
import { EventCover, PATTERN_LABELS, TONES } from '../events/EventCover.jsx'

const TONE_LABELS = { magenta: 'Gele magenta', gold: 'Gold', teal: 'Teal', coral: 'Coral', plum: 'Plum' }

function Card({ title, children }) {
  return (
    <fieldset className="space-y-5 rounded-2xl border border-line bg-panel p-4 sm:p-5">
      {title && <legend className="float-left mb-1 w-full font-display text-xl font-semibold">{title}</legend>}
      <div className="clear-left space-y-5">{children}</div>
    </fieldset>
  )
}

/** Step 1: what the event is, how it looks, who runs it. */
export function DetailsStep({ form }) {
  return (
    <div className="space-y-6">
      <Card>
        <TextField form={form} name="title" label="Event name" hint="What guests will see on the card and the page." />
        <TextAreaField
          form={form}
          name="summary"
          label="One-line summary"
          optional
          rows={2}
          maxLength={160}
          hint="Shown on the event card. Up to 160 characters."
        />
        <TextAreaField
          form={form}
          name="description"
          label="Description"
          rows={8}
          maxLength={4000}
          hint="What to expect, what to wear, what to bring. Leave a blank line between paragraphs."
        />
        <SelectField form={form} name="category" label="Category" options={CATEGORIES} />
      </Card>

      <Card title="Cover">
        <EventCover cover={form.values.cover} className="h-28 rounded-xl" />
        <RadioGroupField
          form={form}
          name="cover.pattern"
          label="Pattern"
          options={COVER_PATTERNS.map((p) => ({ id: p, label: PATTERN_LABELS[p] }))}
          variant="pills"
        />
        <RadioGroupField form={form} name="cover.tone" label="Colour" variant="pills" options={COVER_TONES.map((t) => ({ id: t, label: TONE_LABELS[t] }))} />
        <div aria-hidden="true" className="-mt-3 flex gap-2">
          {COVER_TONES.map((t) => (
            <span key={t} className="h-1.5 flex-1 rounded-full" style={{ backgroundColor: TONES[t].bg }} />
          ))}
        </div>
      </Card>

      <Card title="Organiser">
        <TextField
          form={form}
          name="organiser.name"
          label="Organiser name"
          hint="A person, family, church or company, e.g. “The Adébáyọ̀ family”."
          autoComplete="organization"
        />
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField form={form} name="organiser.email" label="Contact email" type="email" inputMode="email" autoComplete="email" />
          <TextField
            form={form}
            name="organiser.phone"
            label="Contact phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            optional
            hint="A Nigerian mobile."
          />
        </div>
      </Card>
    </div>
  )
}

/** Step 2: dates (entered in Lagos time) and the venue. */
export function WhenWhereStep({ form }) {
  return (
    <div className="space-y-6">
      <Card title="When">
        <p className="-mt-2 text-sm text-ink-faint">Enter times in Lagos time (WAT). Guests anywhere see the same times.</p>
        <div className="grid gap-5 sm:grid-cols-2">
          <DateTimeField form={form} name="startsAt" label="Starts" />
          <DateTimeField form={form} name="endsAt" label="Ends" hint="Can be on a later day, e.g. a 3-day conference." />
        </div>
      </Card>
      <Card title="Where">
        <TextField form={form} name="venue.name" label="Venue name" />
        <TextField
          form={form}
          name="venue.address"
          label="Address"
          autoComplete="street-address"
          hint="Street and area, e.g. 14 Ozumba Mbadiwe Avenue, Victoria Island."
        />
        <SelectField form={form} name="venue.city" label="City" options={CITIES.map((c) => ({ id: c, label: c }))} />
      </Card>
    </div>
  )
}
