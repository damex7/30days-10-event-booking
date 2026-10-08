import { computeTotals } from './booking.js'
import { lagosAt, lagosDateKey } from './dates.js'
import { choicesOf, pruneAnswers, visibleQuestions } from './questions.js'

/*
  Demo data: six events and enough bookings for the dashboards to mean
  something. Dates are counted from the day you first open the app (not
  fixed calendar dates), so "This week" always has an event in it and
  nothing is in the past on day one.

  Bookings are made by a SEEDED random generator: the same "random" names
  and answers every time, so the demo is predictable when you test it.
  Spots are never stored: "6 left" comes from these bookings (see booking.js).
*/

/** mulberry32: a tiny seeded random number generator. Same seed → same sequence. */
function makeRandom(seed) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const FIRST = [
  'Tolúwanimí', 'Adaeze', 'Chukwuemeka', 'Fatima', 'Ibrahim', 'Ọlámidé', 'Ngozi', 'Emeka', 'Zainab', 'Babatunde', 'Chiamaka', 'Aisha',
  'Oluwaseun', 'Ifeanyi', 'Hauwa', 'Kelechi', 'Yetunde', 'Musa', 'Ebere', 'Ṣadé', 'Femi', 'Amaka', 'Usman', 'Bisola', 'Tamuno',
  'Ekaette', 'Osas', 'Damilola', 'Nnamdi', 'Halima', 'Temitọpẹ́', 'Uche', 'Efe', 'Kemi', 'Obinna', 'Bọ́lá', 'Idris', 'Ifeoma', 'Tobi', 'Ese',
]
const LAST = [
  'Adébáyọ̀', 'Okafor', 'Bello', 'Okonkwo', 'Abubakar', 'Ogunlesi', 'Eze', 'Danjuma', 'Adeyemi', 'Nwosu', 'Yusuf', 'Balogun', 'Obi',
  'Lawal', 'Akpan', 'Ibekwe', 'Ọlátúnjí', 'Mohammed', 'Etim', 'Ogbonna', 'Ajayi', 'Uzoma', 'Sani', 'Coker', 'Briggs', 'Okon', 'Fashola',
]

const asciiName = (s) =>
  s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()

/* ---------- The six events ---------- */

function events(now) {
  const at = (days, hhmm) => lagosAt(days, hhmm, now)
  // The comedy show is always this week (by Sunday), so the "This week" filter has something in it.
  const weekday = new Date(`${lagosDateKey(now)}T12:00:00Z`).getUTCDay()
  const comedyDay = weekday === 0 ? 0 : Math.min(2, 7 - weekday)
  const created = now.toISOString()
  const base = { createdAt: created, updatedAt: created }

  return [
    {
      ...base,
      id: 'evt_owambe',
      slug: 'tolu-and-dayos-wedding-owambe',
      title: 'Tolú & Dàyọ̀’s Wedding Owambe',
      category: 'wedding',
      summary: 'Two families, one big party. Gold, wine and emerald, jollof, and a live band until the sun sets.',
      description:
        'You are warmly invited to celebrate the wedding of Tolúwalọpẹ́ and Dàyọ̀ at their traditional and reception party.\n\nThe colours of the day are gold & wine for the bride’s family and champagne & emerald for the groom’s. If you’d like aso-ebi, tell us your colour, head piece and size when you book. It’s ₦35,000 per person (fabric plus gele or fila), paid to the family; we’ll send account details on WhatsApp.\n\nGuests with an invitation should book a free Guest place for everyone coming, so we can plan seating and small chops. Children are welcome.',
      cover: { pattern: 'gele', tone: 'magenta' },
      startsAt: at(38, '12:00'),
      endsAt: at(38, '19:00'),
      venue: { name: 'Ocean Pearl Event Hall', address: '14 Ozumba Mbadiwe Avenue, Victoria Island', city: 'Lagos' },
      organiser: { name: 'The Adébáyọ̀ & Okafor families', email: 'toluanddayo@example.com', phone: '+2348031234567' },
      maxPerBooking: 6,
      tickets: [
        { id: 'tkt_guest', name: 'Guest', description: 'For invited guests. One place per person, children included.', priceKobo: 0, quantity: 300, salesEndAt: at(31, '23:59') },
        { id: 'tkt_family', name: 'Close family (front tables)', description: 'Reserved tables near the couple, for immediate family.', priceKobo: 0, quantity: 40, salesEndAt: at(31, '23:59') },
      ],
      questions: [
        { id: 'q_side', label: 'Whose guest are you?', hint: '', type: 'single', required: true, perAttendee: false, options: [{ id: 'o_bride', label: 'Bride’s family or friends' }, { id: 'o_groom', label: 'Groom’s family or friends' }, { id: 'o_both', label: 'Friend of the couple' }], min: null, max: null, notInPast: false, showIf: null },
        { id: 'q_asoebi', label: 'Do you want aso-ebi?', hint: '₦35,000 per person: fabric plus gele or fila, paid to the family.', type: 'yesno', required: true, perAttendee: true, options: [], min: null, max: null, notInPast: false, showIf: null },
        { id: 'q_colour', label: 'Aso-ebi colour', hint: '', type: 'single', required: true, perAttendee: true, options: [{ id: 'o_goldwine', label: 'Gold & wine (bride’s side)' }, { id: 'o_champemerald', label: 'Champagne & emerald (groom’s side)' }], min: null, max: null, notInPast: false, showIf: { questionId: 'q_asoebi', anyOf: ['yes'] } },
        { id: 'q_headpiece', label: 'Head piece', hint: '', type: 'single', required: true, perAttendee: true, options: [{ id: 'o_gele', label: 'Gele' }, { id: 'o_fila', label: 'Fila (cap)' }, { id: 'o_none', label: 'No head piece' }], min: null, max: null, notInPast: false, showIf: { questionId: 'q_asoebi', anyOf: ['yes'] } },
        { id: 'q_size', label: 'Size', hint: 'UK dress sizes. The tailor will adjust the fit.', type: 'single', required: true, perAttendee: true, options: [{ id: 'o_s', label: 'S (8–10)' }, { id: 'o_m', label: 'M (12–14)' }, { id: 'o_l', label: 'L (16–18)' }, { id: 'o_xl', label: 'XL (20–22)' }, { id: 'o_xxl', label: 'XXL (24+)' }], min: null, max: null, notInPast: false, showIf: { questionId: 'q_asoebi', anyOf: ['yes'] } },
        { id: 'q_diet', label: 'Dietary needs', hint: 'For example: no pork, vegetarian, nut allergy.', type: 'short', required: false, perAttendee: true, options: [], min: null, max: null, notInPast: false, showIf: null },
        { id: 'q_parking', label: 'Will you need a parking space?', hint: '', type: 'yesno', required: false, perAttendee: false, options: [], min: null, max: null, notInPast: false, showIf: null },
      ],
      promoCodes: [],
    },
    {
      ...base,
      id: 'evt_lagosjs',
      slug: 'lagos-js-meetup-forms-that-dont-fight-you',
      title: 'Lagos JS Meetup: Forms that don’t fight you',
      category: 'tech',
      summary: 'Talks on validation, accessibility and React forms, then jollof and networking.',
      description:
        'This month’s Lagos JS meetup is all about forms: the part of every app people actually type into.\n\n• “Reward early, punish late”: validation timing that doesn’t shout at users\n• Building forms from config, with conditional questions\n• Accessible errors: aria-describedby, error summaries and focus\n\nGeneral admission is free. Supporter tickets help us pay for the venue and include a meetup T-shirt. Doors open at 9:30. Bring your laptop if you want to follow along.',
      cover: { pattern: 'grid', tone: 'teal' },
      startsAt: at(5, '10:00'),
      endsAt: at(5, '15:00'),
      venue: { name: 'The Workbench Hub', address: '294 Herbert Macaulay Way, Yaba', city: 'Lagos' },
      organiser: { name: 'Lagos JS Community', email: 'hello@lagosjs.example.com', phone: '+2348091112233' },
      maxPerBooking: 2,
      tickets: [
        { id: 'tkt_general', name: 'General admission', description: 'Talks, lunch and networking.', priceKobo: 0, quantity: 120, salesEndAt: null },
        { id: 'tkt_supporter', name: 'Supporter', description: 'Everything in General, plus a meetup T-shirt. Thank you!', priceKobo: 500_000, quantity: 30, salesEndAt: null },
      ],
      questions: [
        { id: 'q_level', label: 'How long have you been writing JavaScript?', hint: '', type: 'single', required: true, perAttendee: true, options: [{ id: 'o_new', label: 'Just starting' }, { id: 'o_1to2', label: '1–2 years' }, { id: 'o_3to5', label: '3–5 years' }, { id: 'o_5plus', label: 'More than 5 years' }], min: null, max: null, notInPast: false, showIf: null },
        { id: 'q_topics', label: 'What would you like more of at future meetups?', hint: 'Pick up to 3.', type: 'multi', required: false, perAttendee: true, options: [{ id: 'o_react', label: 'React' }, { id: 'o_forms', label: 'Forms & validation' }, { id: 'o_testing', label: 'Testing' }, { id: 'o_node', label: 'Node.js' }, { id: 'o_career', label: 'Career & interviews' }], min: null, max: 3, notInPast: false, showIf: null },
        { id: 'q_first', label: 'Is this your first Lagos JS meetup?', hint: '', type: 'yesno', required: true, perAttendee: true, options: [], min: null, max: null, notInPast: false, showIf: null },
        { id: 'q_heard', label: 'How did you hear about us?', hint: '', type: 'single', required: false, perAttendee: true, options: [{ id: 'o_x', label: 'X (Twitter)' }, { id: 'o_whatsapp', label: 'A WhatsApp group' }, { id: 'o_friend', label: 'A friend' }, { id: 'o_linkedin', label: 'LinkedIn' }], min: null, max: null, notInPast: false, showIf: { questionId: 'q_first', anyOf: ['yes'] } },
      ],
      promoCodes: [{ code: 'LAGOSDEV', kind: 'percent', value: 50 }],
    },
    {
      ...base,
      id: 'evt_afrobeats',
      slug: 'afrobeats-under-the-stars-abuja',
      title: 'Afrobeats Under the Stars',
      category: 'music',
      summary: 'An open-air night of live Afrobeats, highlife and amapiano by the lake in Abuja.',
      description:
        'Six acts, one stage, and the Abuja sky. Expect a live band, surprise guests and the best suya in the FCT.\n\nRegular tickets are standing. VIP includes a seated lounge and a drink. A table seats six and comes with a bottle and a host.\n\nGates open at 5:00 pm. 18+ only: bring ID.',
      cover: { pattern: 'rays', tone: 'plum' },
      startsAt: at(16, '18:00'),
      endsAt: at(17, '01:00'),
      venue: { name: 'Jabi Lakeside Arena', address: 'Jabi Lake, off Obafemi Awolowo Way', city: 'Abuja' },
      organiser: { name: 'Zuma Live', email: 'tickets@zumalive.example.com', phone: '+2348051234000' },
      maxPerBooking: 8,
      tickets: [
        { id: 'tkt_regular', name: 'Regular', description: 'Standing, general area.', priceKobo: 1_500_000, quantity: 300, salesEndAt: null },
        { id: 'tkt_vip', name: 'VIP', description: 'Seated lounge, fast entry and one drink.', priceKobo: 5_000_000, quantity: 60, salesEndAt: null },
        { id: 'tkt_table', name: 'Table for 6', description: 'One table, six seats, a bottle and a host. Book one per table.', priceKobo: 40_000_000, quantity: 10, salesEndAt: null },
      ],
      questions: [
        { id: 'q_adult', label: 'Is everyone in your group 18 or older?', hint: 'We check ID at the gate.', type: 'yesno', required: true, perAttendee: false, options: [], min: null, max: null, notInPast: false, showIf: null },
      ],
      promoCodes: [],
    },
    {
      ...base,
      id: 'evt_harvest',
      slug: 'harvest-of-grace-conference',
      title: 'Harvest of Grace Conference',
      category: 'faith',
      summary: 'Three days of worship, teaching and fellowship in Ibadan. Free to attend, with optional accommodation.',
      description:
        'Join believers from across the South-West for three days of worship, Bible teaching and fellowship.\n\nRegistration is free. The Partner pack includes meals for all three days and a conference notebook, and helps us host everyone.\n\nComing from outside Ibadan? Tell us if you need accommodation and we’ll place you with a host family or in the conference hostel.',
      cover: { pattern: 'lace', tone: 'gold' },
      startsAt: at(23, '17:00'),
      endsAt: at(25, '14:00'),
      venue: { name: 'Cornerstone Convention Ground', address: 'Km 4, Ring Road', city: 'Ibadan' },
      organiser: { name: 'Harvest of Grace Ministries', email: 'register@harvestofgrace.example.com', phone: '+2348067654321' },
      maxPerBooking: 10,
      tickets: [
        { id: 'tkt_free', name: 'Free registration', description: 'All sessions, all three days.', priceKobo: 0, quantity: 1500, salesEndAt: null },
        { id: 'tkt_partner', name: 'Partner pack', description: 'Meals for three days and a conference notebook.', priceKobo: 1_000_000, quantity: 300, salesEndAt: null },
      ],
      questions: [
        { id: 'q_church', label: 'Church or fellowship', hint: '', type: 'short', required: false, perAttendee: false, options: [], min: null, max: null, notInPast: false, showIf: null },
        { id: 'q_accom', label: 'Do you need accommodation?', hint: 'Host families and the hostel are free; space is limited.', type: 'yesno', required: true, perAttendee: true, options: [], min: null, max: null, notInPast: false, showIf: null },
        { id: 'q_nights', label: 'How many nights?', hint: 'Between 1 and 3.', type: 'number', required: true, perAttendee: true, options: [], min: 1, max: 3, notInPast: false, showIf: { questionId: 'q_accom', anyOf: ['yes'] } },
        { id: 'q_arrive', label: 'Arrival date', hint: '', type: 'date', required: true, perAttendee: true, options: [], min: null, max: null, notInPast: true, showIf: { questionId: 'q_accom', anyOf: ['yes'] } },
        { id: 'q_counsel', label: 'Would you like a counsellor to reach out to you?', hint: '', type: 'yesno', required: false, perAttendee: true, options: [], min: null, max: null, notInPast: false, showIf: null },
      ],
      promoCodes: [{ code: 'PARTNER2K', kind: 'fixed', value: 200_000 }],
    },
    {
      ...base,
      id: 'evt_laugh',
      slug: 'laugh-out-lagos-weekend-special',
      title: 'Laugh Out Lagos: Weekend Special',
      category: 'comedy',
      summary: 'Five comedians, one host, zero chill. Front rows get roasted.',
      description:
        'End the week laughing. Five of Lagos’ sharpest stand-ups, a host who never misses, and a DJ until late.\n\nCelebrating something? Tell us when you book and the host will give you a shout-out from the stage.\n\nDoors open at 6:30 pm; the show starts at 7:00 pm sharp. VIP seats are in the first three rows: you have been warned.',
      cover: { pattern: 'dots', tone: 'coral' },
      startsAt: at(comedyDay, '19:00'),
      endsAt: at(comedyDay, '22:30'),
      venue: { name: 'Lekki Arts Theatre', address: '7 Admiralty Way, Lekki Phase 1', city: 'Lagos' },
      organiser: { name: 'Laugh Out Lagos', email: 'hello@laughoutlagos.example.com', phone: '+2349012345678' },
      maxPerBooking: 6,
      tickets: [
        { id: 'tkt_reg', name: 'Regular', description: 'Unreserved seating.', priceKobo: 1_000_000, quantity: 200, salesEndAt: null },
        { id: 'tkt_vipc', name: 'VIP', description: 'First three rows and a free drink.', priceKobo: 2_500_000, quantity: 40, salesEndAt: null },
      ],
      questions: [
        { id: 'q_celebrate', label: 'Are you celebrating anything?', hint: '', type: 'yesno', required: false, perAttendee: false, options: [], min: null, max: null, notInPast: false, showIf: null },
        { id: 'q_what', label: 'What are we celebrating?', hint: 'A birthday, a new job, surviving Third Mainland Bridge traffic…', type: 'short', required: true, perAttendee: false, options: [], min: null, max: null, notInPast: false, showIf: { questionId: 'q_celebrate', anyOf: ['yes'] } },
      ],
      promoCodes: [{ code: 'LAUGH20', kind: 'percent', value: 20 }],
    },
    {
      ...base,
      id: 'evt_garden',
      slug: 'grow-your-own-ugu-community-workshop',
      title: 'Grow Your Own Ugu: Community Garden Workshop',
      category: 'community',
      summary: 'A free, hands-on morning learning to grow ugu, tete and scent leaf in small spaces.',
      description:
        'Learn to grow your own vegetables in a small yard or on a balcony, with soil, seeds and seedlings provided.\n\nWe’ll cover sacks and containers, compost from kitchen waste, and keeping pests away without chemicals. Everyone goes home with a tray of seedlings.\n\nChildren are very welcome. Wear clothes that can get muddy.',
      cover: { pattern: 'waves', tone: 'teal' },
      startsAt: at(9, '09:00'),
      endsAt: at(9, '13:00'),
      venue: { name: 'Rumuola Community Garden', address: 'Behind Rumuola Town Hall, Rumuola Road', city: 'Port Harcourt' },
      organiser: { name: 'Rivers Green Collective', email: 'grow@riversgreen.example.com', phone: '+2347031239876' },
      maxPerBooking: 4,
      tickets: [{ id: 'tkt_place', name: 'Workshop place', description: 'One adult. Children under 12 don’t need a place.', priceKobo: 0, quantity: 40, salesEndAt: null }],
      questions: [
        { id: 'q_children', label: 'How many children are coming with you?', hint: 'Children under 12 don’t need a place. We’ll prepare seed kits for them.', type: 'number', required: true, perAttendee: false, options: [], min: 0, max: 5, notInPast: false, showIf: null },
        { id: 'q_tools', label: 'Will you bring your own gloves?', hint: 'We have 20 spare pairs.', type: 'yesno', required: true, perAttendee: false, options: [], min: null, max: null, notInPast: false, showIf: null },
        { id: 'q_access', label: 'Any access needs we should know about?', hint: 'The garden is flat, with one step at the gate.', type: 'long', required: false, perAttendee: false, options: [], min: null, max: null, notInPast: false, showIf: null },
      ],
      promoCodes: [],
    },
  ]
}

/* How many of each ticket to "sell" in the seed, and how many bookings to cancel. */
const SALES = {
  evt_owambe: { tkt_guest: 164, tkt_family: 33 },
  evt_lagosjs: { tkt_general: 113, tkt_supporter: 9 },
  evt_afrobeats: { tkt_regular: 300, tkt_vip: 60, tkt_table: 10 }, // fully sold out → waitlist
  evt_harvest: { tkt_free: 186, tkt_partner: 41 },
  evt_laugh: { tkt_reg: 194, tkt_vipc: 40 }, // Regular: 6 left; VIP sold out
  evt_garden: { tkt_place: 22 },
}

/* Answers that look like real people's, by question id; anything else gets a random valid answer. */
const ANSWERS = {
  q_diet: ['', '', '', 'No pork', 'Vegetarian', 'Nut allergy', 'No pepper, please'],
  q_church: ['', 'Redeemed Christian Church of God', 'Living Faith Church', 'St. Anne’s Anglican', 'Deeper Life Bible Church', ''],
  q_what: ['My birthday!', 'New job', 'Our anniversary', 'Finally finished my project', 'Graduation'],
  q_access: ['', '', '', 'I use a walking stick.', ''],
}

function randomAnswer(q, random, now, eventStartsAt) {
  const pick = (arr) => arr[Math.floor(random() * arr.length)]
  if (ANSWERS[q.id]) return pick(ANSWERS[q.id])
  if (!q.required && random() < 0.25) return q.type === 'multi' ? [] : ''
  switch (q.type) {
    case 'yesno':
      return random() < (q.id === 'q_asoebi' ? 0.6 : 0.5) ? 'yes' : 'no'
    case 'single':
      return pick(choicesOf(q)).id
    case 'multi': {
      const max = q.max ?? q.options.length
      return q.options.filter(() => random() < 0.35).slice(0, max).map((o) => o.id)
    }
    case 'number': {
      const min = q.min ?? 0
      const max = q.max ?? min + 5
      return String(min + Math.floor(random() * (max - min + 1)))
    }
    case 'date':
      return eventStartsAt.slice(0, 10)
    default:
      return pick(['', 'Looking forward to it', 'See you there'])
  }
}

function answerQuestions(questions, random, now, startsAt, bookingAnswers, guestAnswers, scope) {
  // Fill in order, so a condition's parent is answered before the child is considered.
  for (const q of questions.filter((x) => (scope === 'guest') === x.perAttendee)) {
    const visible = visibleQuestions(questions, { bookingAnswers, guestAnswers, scope }).some((v) => v.id === q.id)
    if (visible) (scope === 'guest' ? guestAnswers : bookingAnswers)[q.id] = randomAnswer(q, random, now, startsAt)
  }
}

const REF_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'

/** A booking reference in the real format (IPE-7KQ3HX), from the seeded generator, never repeated. */
function seedReference(random, used) {
  for (;;) {
    let ref = 'IPE-'
    for (let i = 0; i < 6; i++) ref += REF_ALPHABET[Math.floor(random() * REF_ALPHABET.length)]
    if (!used.has(ref)) {
      used.add(ref)
      return ref
    }
  }
}

function bookingsFor(event, random, now, used, sales = SALES[event.id] ?? {}) {
  const pick = (arr) => arr[Math.floor(random() * arr.length)]
  const person = () => {
    const first = pick(FIRST)
    const last = pick(LAST)
    const tail = String(Math.floor(random() * 10_000)).padStart(4, '0')
    return {
      name: `${first} ${last}`,
      email: `${asciiName(first)}.${asciiName(last)}${Math.floor(random() * 90) + 10}@example.com`,
      phone: `+234${pick(['803', '806', '810', '813', '816', '703', '706', '905', '813', '701'])}555${tail}`,
    }
  }

  const out = []
  for (const ticket of event.tickets) {
    let left = sales[ticket.id] ?? 0
    while (left > 0) {
      const quantity = Math.min(left, 1 + Math.floor(random() * Math.min(4, event.maxPerBooking)))
      left -= quantity
      const buyer = person()
      const reference = seedReference(random, used)
      const bookingAnswers = {}
      answerQuestions(event.questions, random, now, event.startsAt, bookingAnswers, null, 'booking')
      const attendees = Array.from({ length: quantity }, (_, i) => {
        let guest = buyer
        if (i > 0) {
          guest = person()
          if (random() < 0.4) guest.email = '' // some guests only give a phone number
        }
        const answers = {}
        answerQuestions(event.questions, random, now, event.startsAt, bookingAnswers, answers, 'guest')
        return { id: `att_${reference.slice(4).toLowerCase()}${i}`, ticketId: ticket.id, ...guest, answers }
      })
      const pruned = pruneAnswers(event.questions, { answers: bookingAnswers, attendees })
      const totals = computeTotals(event, { [ticket.id]: quantity })
      out.push({
        id: `bkg_${reference.slice(4).toLowerCase()}`,
        reference,
        eventId: event.id,
        status: 'confirmed',
        createdAt: new Date(now.getTime() - Math.floor(random() * 20 * 86_400_000)).toISOString(),
        cancelledAt: null,
        buyer,
        items: totals.items.map(({ lineKobo, ...item }) => item),
        attendees: pruned.attendees,
        answers: pruned.answers,
        promo: null,
        subtotalKobo: totals.subtotalKobo,
        discountKobo: 0,
        totalKobo: totals.totalKobo,
      })
    }
  }
  return out
}

/** A fresh demo database. */
export function createSeed(now = new Date()) {
  const random = makeRandom(10)
  const used = new Set()
  const list = events(now)
  const bookings = list.flatMap((e) => bookingsFor(e, random, now, used))

  // Two cancelled bookings, so the dashboard shows that state. They don't hold spots.
  const cancelled = bookingsFor(list[0], random, now, used, { tkt_guest: 2, tkt_family: 2 }).map((b) => ({
    ...b,
    status: 'cancelled',
    cancelledAt: now.toISOString(),
  }))

  const waitlist = [
    { id: 'wl_seed1', eventId: 'evt_afrobeats', ticketId: null, name: 'Halima Yusuf', email: 'halima.yusuf@example.com', phone: '+2348035550191', createdAt: now.toISOString() },
    { id: 'wl_seed2', eventId: 'evt_laugh', ticketId: 'tkt_vipc', name: 'Femi Coker', email: '', phone: '+2348135554410', createdAt: now.toISOString() },
  ]

  return { version: 1, events: list, bookings: [...bookings, ...cancelled], waitlist }
}
