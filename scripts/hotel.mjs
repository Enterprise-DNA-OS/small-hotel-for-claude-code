#!/usr/bin/env node
// The front desk CLI. Every slash command in .claude/commands runs one of these.
//   npm run hotel -- <report>                     arrivals, housekeeping, attention, occupancy, channel-mix, ... (see help)
//   npm run hotel -- <action> <args> [--flags]    book, check-in, check-out, charge, pay, room-status, night-audit, ...
// Human tables by default, --json for machines. Names match exactly, then by fragment; ambiguous lists candidates and exits 1.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { getDb, REPO_ROOT } from './lib/db.mjs';
import { table } from './lib/format.mjs';
import { entities, refs, money, reports, resolve, resolveBooking } from './lib/domain.mjs';
import { importLittleHotelier, importIcal, icalFor, toDate } from './lib/import.mjs';

export const actions = ['quote', 'book', 'assign', 'move', 'change-dates', 'check-in', 'check-out', 'cancel', 'no-show', 'charge', 'pay', 'refund',
  'room-status', 'night-audit', 'add', 'set', 'log', 'import', 'ical-export', 'export',
  'draft-confirmation', 'draft-prearrival', 'draft-deposit-reminder', 'draft-review-request'];
const specials = ['help', 'availability', 'booking', 'guest', 'weekly-review'];
const BOOLEAN_FLAGS = ['json', 'apply', 'help', 'force', 'owing', 'deposit', 'long-stay', 'no-gst', 'enquiry', 'new-guest'];
const OPEN = ['enquiry', 'confirmed', 'checked_in'];

export function parseArgs(args) {
  const flags = {}, pos = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (!a.startsWith('--')) { pos.push(a); continue; }
    const eq = a.indexOf('=');
    if (eq >= 0) flags[a.slice(2, eq).replaceAll('-', '_')] = a.slice(eq + 1);
    else if (BOOLEAN_FLAGS.includes(a.slice(2))) flags[a.slice(2).replaceAll('-', '_')] = true;
    else if (args[i + 1] !== undefined && !args[i + 1].startsWith('--')) flags[a.slice(2).replaceAll('-', '_')] = args[++i];
    else throw Error(`Flag ${a} needs a value`);
  }
  return { flags, pos };
}

const required = (v, what) => { if (v === undefined || v === null || String(v).trim() === '') throw Error(`Required: ${what}`); return v; };
function toCents(v, what, { negative = false } = {}) {
  const n = Number(String(required(v, what)).replace(/[$,]/g, ''));
  if (!Number.isFinite(n) || (!negative && n < 0)) throw Error(`${what} must be an amount like 189.50`);
  return Math.round(n * 100);
}
const isoDay = (v, what) => (v === undefined || v === null ? null : toDate(v, 'dmy', what));
const addDays = (iso, n) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
const fmt = (cents, cur) => `${cur} ${(Number(cents) / 100).toFixed(2)}`;
const today = async (db) => (await db.query('select hotel_today()::text d'))[0].d;
const settingsOf = async (db) => (await db.query('select * from settings'))[0];

// "3" nights, or a check-out date.
function departFrom(arrive, v) {
  const s = String(required(v, 'nights or a check-out date'));
  if (/^\d{1,3}$/.test(s)) {
    if (Number(s) < 1) throw Error('At least one night');
    return addDays(arrive, Number(s));
  }
  const d = isoDay(s, 'check-out');
  if (d <= arrive) throw Error(`Check-out ${d} is not after check-in ${arrive}`);
  return d;
}

async function audit(db, action, id, detail) {
  await db.query('insert into audit (action, record_id, detail) values ($1, $2, $3)', [action, id || null, JSON.stringify(detail)]);
}

// add/set: --field=value pairs checked against the entity's allowed list; names resolve to ids, dollars to cents.
async function record(db, entity, flags, existing = null) {
  const def = entities[entity];
  if (!def) throw Error(`Record type must be one of ${Object.keys(entities).join(', ')}`);
  const [tableName, , allowed] = def;
  const cols = [], vals = [];
  for (const [key, raw] of Object.entries(flags)) {
    if (['json', 'force'].includes(key)) continue;
    if (!allowed.includes(key)) throw Error(`Unknown ${entity} field --${key.replaceAll('_', '-')}. Allowed: ${allowed.join(', ')}`);
    let v = raw === 'null' ? null : raw;
    let col = key;
    if (refs[key]) { col = refs[key][0]; if (v !== null) v = (await resolve(db, refs[key][1], v)).id; }
    else if (money[key]) { col = money[key]; if (v !== null) v = toCents(v, key); }
    else if (/_on$/.test(key) && v !== null) v = isoDay(v, key);
    else if (v === true) v = 'true';
    cols.push(col); vals.push(v);
  }
  if (!cols.length) throw Error('Give at least one --field=value');
  if (existing) {
    vals.push(existing.id);
    return db.query(`update ${tableName} set ${cols.map((c, i) => `${c} = $${i + 1}`).join(', ')} where id = $${vals.length} returning *`, vals);
  }
  return db.query(`insert into ${tableName} (${cols.join(', ')}) values (${vals.map((_, i) => `$${i + 1}`).join(', ')}) returning *`, vals);
}

// The price of each night: the shortest rate plan covering it, else the room type's base rate.
async function priceStay(db, typeId, arrive, depart, flags = {}) {
  const nights = await db.query(`select d::date::text night_on, coalesce(p.nightly_cents, t.base_rate_cents) rate_cents, coalesce(p.name, 'Base rate') rate_plan, coalesce(p.min_nights, 1) min_nights
    from room_types t cross join generate_series($2::date, $3::date - 1, interval '1 day') d
    left join lateral (select name, nightly_cents, min_nights from rate_plans r where r.room_type_id = t.id and d::date between r.starts_on and r.ends_on order by r.ends_on - r.starts_on limit 1) p on true
    where t.id = $1 order by 1`, [typeId, arrive, depart]);
  if (flags.rate !== undefined) { const c = toCents(flags.rate, '--rate'); for (const n of nights) { n.rate_cents = c; n.rate_plan = 'Agreed rate'; } }
  const min = Math.max(...nights.map((n) => Number(n.min_nights)));
  if (flags.rate === undefined && nights.length < min && !flags.force) throw Error(`${nights.find((n) => Number(n.min_nights) === min).rate_plan} needs at least ${min} nights. Use --force to take it anyway`);
  return nights.map(({ min_nights, ...n }) => ({ ...n, rate_cents: Number(n.rate_cents) }));
}

// Rooms of a type free for every night of a stay: not booked, not blocked by an outside calendar, not out of order.
async function freeRooms(db, typeId, arrive, depart, exceptBooking = null) {
  return db.query(`select r.* from rooms r where r.active and ($1::uuid is null or r.room_type_id = $1)
    and not (r.status = 'out_of_order' and (r.out_of_order_until is null or r.out_of_order_until >= $2::date))
    and not exists (select 1 from v_live b where b.room_id = r.id and b.arrive_on < $3 and $2 < b.depart_on and b.id is distinct from $4::uuid)
    and not exists (select 1 from blocks k where k.room_id = r.id and k.starts_on < $3 and $2 < k.ends_on)
    order by case r.status when 'inspected' then 0 when 'clean' then 1 else 2 end, r.sort, r.name`, [typeId, arrive, depart, exceptBooking]);
}

// For a stay with no room chosen: every night must have a room of the type left after the other unassigned bookings.
async function typeHasRoom(db, typeId, arrive, depart, exceptBooking = null) {
  const short = await db.query(`select d::date::text night from generate_series($2::date, $3::date - 1, interval '1 day') d
    where (select count(*) from rooms r where r.active and r.room_type_id = $1
        and not (r.status = 'out_of_order' and (r.out_of_order_until is null or r.out_of_order_until >= d::date))
        and not exists (select 1 from v_live b where b.room_id = r.id and b.arrive_on <= d::date and d::date < b.depart_on and b.id is distinct from $4::uuid)
        and not exists (select 1 from blocks k where k.room_id = r.id and k.starts_on <= d::date and d::date < k.ends_on))
      - (select count(*) from v_live b where b.room_type_id = $1 and b.room_id is null and b.arrive_on <= d::date and d::date < b.depart_on and b.id is distinct from $4::uuid) < 1
    order by 1`, [typeId, arrive, depart, exceptBooking]);
  return short.map((r) => r.night);
}

async function writeNights(db, bookingId, nights) {
  await db.query('delete from booking_nights where booking_id = $1', [bookingId]);
  for (const n of nights) await db.query('insert into booking_nights (booking_id, night_on, rate_cents, rate_plan) values ($1, $2, $3, $4)', [bookingId, n.night_on, n.rate_cents, n.rate_plan]);
}

async function nextNumber(db, table, column, prefix, start = 1001) {
  const esc = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const [r] = await db.query(`select coalesce(max(substring(${column} from $1)::int), $2 - 1) + 1 n from ${table}`, [`^${esc}(\\d+)$`, start]);
  return `${prefix}${r.n}`;
}

async function folio(db, id) {
  return (await db.query('select * from v_folio where id = $1', [id]))[0];
}

async function writeDraft(name, body) {
  const dir = path.resolve(process.env.OUTPUT_DIR || REPO_ROOT, 'drafts');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-${Date.now()}.md`);
  fs.writeFileSync(file, body, { flag: 'wx' });
  return file;
}

async function guestFor(db, name, flags) {
  if (!flags.new_guest) {
    const found = await db.query('select * from guests where lower(name) = lower($1) or (email <> \'\' and lower(email) = lower($2))', [name, flags.email || '']);
    if (found.length === 1) return found[0];
    if (found.length > 1) throw Error(`More than one guest called "${name}". Candidates:\n${found.map((g) => `  ${g.id.slice(0, 8)}  ${g.name}  ${g.email}`).join('\n')}\nUse the id, or --new-guest`);
  }
  return (await db.query('insert into guests (name, email, phone, country) values ($1, $2, $3, $4) returning *', [required(name, 'guest name'), flags.email || '', flags.phone || '', flags.country || '']))[0];
}

async function stayView(db, b) {
  const s = await settingsOf(db);
  const f = await folio(db, b.id);
  return {
    booking: [{ ref: f.ref, status: f.status, guest: f.guest, room_type: f.room_type, room: f.room || 'not assigned', arrive_on: f.arrive_on, depart_on: f.depart_on, nights: f.nights, channel: f.channel, adults: f.adults, children: f.children }],
    nights: await db.query('select night_on, rate_plan, round(rate_cents / 100.0, 2) rate from booking_nights where booking_id = $1 order by night_on', [b.id]),
    charges: await db.query('select posted_on, kind, description, round(amount_cents / 100.0, 2) amount from charges where booking_id = $1 order by posted_on', [b.id]),
    payments: await db.query('select paid_on, kind, method, round(amount_cents / 100.0, 2) amount, reference from payments where booking_id = $1 order by paid_on', [b.id]),
    folio: [{ currency: s.currency, accommodation: (f.accommodation_cents / 100).toFixed(2), extras: (f.extras_cents / 100).toFixed(2), total: (f.total_cents / 100).toFixed(2), gst_included: (f.gst_cents / 100).toFixed(2),
      paid: (f.paid_cents / 100).toFixed(2), balance: (f.balance_cents / 100).toFixed(2), deposit: (f.deposit_cents / 100).toFixed(2), deposit_due_on: f.deposit_due_on, invoice: (await db.query('select number from invoices where booking_id = $1', [b.id]))[0]?.number || '' }],
    notes: await db.query('select note, created_at from notes where booking_id = $1 order by created_at desc limit 5', [b.id]),
  };
}

export async function run(db, args) {
  const { pos, flags } = parseArgs(args);
  const [cmd = 'help', a, b, c, d] = pos;
  if (cmd === 'help' || flags.help) return [{ reports: [...Object.keys(reports), ...specials.filter((x) => x !== 'help')].join(', '), actions: actions.join(', '), guide: 'docs/cli.md' }];
  if (reports[cmd]) return db.query(reports[cmd]);
  if (cmd === 'weekly-review') {
    return { attention: await db.query(reports.attention), 'next twelve weeks': await db.query(reports.forecast), 'picked up this week': await db.query(reports.pickup), deposits: await db.query(reports.deposits), channels: await db.query(reports['channel-mix']) };
  }
  if (cmd === 'availability') {
    const from = isoDay(flags.from, '--from') || await today(db);
    const n = Math.min(Number(flags.nights || 14), 31);
    const types = await db.query('select id, name from room_types order by base_rate_cents');
    const out = [];
    for (const t of types) {
      const row = { room_type: t.name };
      const free = await db.query(`select d::date::text night, (select count(*) from rooms r where r.active and r.room_type_id = $1
          and not (r.status = 'out_of_order' and (r.out_of_order_until is null or r.out_of_order_until >= d::date))
          and not exists (select 1 from v_live b where b.room_id = r.id and b.arrive_on <= d::date and d::date < b.depart_on)
          and not exists (select 1 from blocks k where k.room_id = r.id and k.starts_on <= d::date and d::date < k.ends_on))
        - (select count(*) from v_live b where b.room_type_id = $1 and b.room_id is null and b.arrive_on <= d::date and d::date < b.depart_on) free
        from generate_series($2::date, $2::date + ($3::int - 1), interval '1 day') d order by 1`, [t.id, from, n]);
      for (const f of free) row[f.night.slice(5)] = Number(f.free);
      out.push(row);
    }
    return out;
  }
  if (cmd === 'booking') return stayView(db, await resolveBooking(db, a));
  if (cmd === 'guest') {
    const g = await resolve(db, 'guest', a);
    return {
      guest: [{ name: g.name, email: g.email, phone: g.phone, address: g.address, country: g.country, company: g.company, vip: g.vip, do_not_rebook: g.do_not_rebook, notes: g.notes }],
      stays: await db.query('select ref, status, room, arrive_on, nights, channel, currency, round(total_cents / 100.0, 2) total, round(balance_cents / 100.0, 2) balance from v_bookings where guest_id = $1 order by arrive_on desc', [g.id]),
      notes: await db.query('select note, created_at from notes where guest_id = $1 order by created_at desc limit 5', [g.id]),
    };
  }
  if (cmd === 'quote') {
    const t = await resolve(db, 'room-type', a);
    const arrive = isoDay(required(b, 'check-in date'), 'check-in');
    const depart = departFrom(arrive, c);
    const nights = await priceStay(db, t.id, arrive, depart, flags);
    const s = await settingsOf(db);
    const short = await typeHasRoom(db, t.id, arrive, depart);
    const total = nights.reduce((n, x) => n + x.rate_cents, 0);
    return { quote: [{ room_type: t.name, arrive_on: arrive, depart_on: depart, nights: nights.length, total: fmt(total, s.currency), available: short.length ? `no, full on ${short.join(', ')}` : 'yes' }], nights: nights.map((n) => ({ night: n.night_on, rate_plan: n.rate_plan, rate: (n.rate_cents / 100).toFixed(2) })) };
  }
  if (cmd === 'export') {
    const file = path.resolve(required(a, 'output file, for example backup/hotel.json'));
    const snapshot = { version: 1, exported_at: new Date().toISOString(), records: {} };
    for (const t of ['settings', 'room_types', 'rooms', 'rate_plans', 'channels', 'guests', 'bookings', 'booking_nights', 'charges', 'payments', 'invoices', 'blocks', 'housekeeping', 'notes', 'audit', 'import_rows']) {
      snapshot.records[t] = await db.query(`select * from ${t}`);
    }
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(snapshot, null, 2) + '\n', { flag: 'wx' });
    return [{ file, records: Object.values(snapshot.records).reduce((n, r) => n + r.length, 0) }];
  }
  if (cmd === 'ical-export') {
    const dir = path.resolve(process.env.OUTPUT_DIR || REPO_ROOT, a || 'feeds');
    fs.mkdirSync(dir, { recursive: true });
    const rooms = flags.room ? [await resolve(db, 'room', flags.room)] : await db.query('select * from rooms where active order by sort, name');
    const out = [];
    for (const r of rooms) {
      const text = await icalFor(db, r, flags);
      const file = path.join(dir, `${r.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.ics`);
      fs.writeFileSync(file, text);
      out.push({ room: r.name, file, busy_periods: (text.match(/BEGIN:VEVENT/g) || []).length });
    }
    return out;
  }
  if (cmd.startsWith('draft-')) return draft(db, cmd, a, flags);
  if (!actions.includes(cmd)) throw Error(`Unknown command "${cmd}". Run help.`);

  await db.exec('BEGIN');
  let result;
  try {
    // One writer at a time on a shared database; reads carry on. Two people cannot sell the same room.
    await db.exec('LOCK TABLE bookings IN SHARE ROW EXCLUSIVE MODE');
    const s = await settingsOf(db);
    const now = await today(db);
    if (cmd === 'add') {
      if (a === 'room' && flags.room_type === undefined) throw Error('A room needs --room-type=');
      result = await record(db, a, Object.fromEntries(Object.entries(flags).filter(([k]) => k !== 'json')));
    } else if (cmd === 'set') {
      if (a === 'settings' || a === 'setting') result = await record(db, 'setting', flags, { id: 1 });
      else result = await record(db, a, Object.fromEntries(Object.entries(flags).filter(([k]) => k !== 'json')), await resolve(db, a, b));
    } else if (cmd === 'import') {
      if (a === 'little-hotelier') result = await importLittleHotelier(db, b, flags);
      else if (a === 'ical') result = await importIcal(db, await resolve(db, 'room', b), c, flags);
      else throw Error('Supported imports: little-hotelier <reservations.csv>, ical <room> <calendar.ics> --source=airbnb');
    } else if (cmd === 'book') {
      const t = await resolve(db, 'room-type', b);
      const arrive = isoDay(required(c, 'check-in date'), 'check-in');
      const depart = departFrom(arrive, d);
      if (arrive < now && !flags.force) throw Error(`Check-in ${arrive} is in the past. Use --force to record a past stay`);
      const guest = await guestFor(db, required(a, 'guest name'), flags);
      if (guest.do_not_rebook && !flags.force) throw Error(`${guest.name} is marked do not rebook: ${guest.notes || 'see the guest record'}. Use --force to book anyway`);
      const adults = Number(flags.adults ?? 2), children = Number(flags.children ?? 0);
      if (adults + children > t.max_guests && !flags.force) throw Error(`${t.name} sleeps ${t.max_guests}; this booking has ${adults + children}. Use --force to take it anyway`);
      const channel = flags.channel ? await resolve(db, 'channel', flags.channel) : null;
      const status = flags.enquiry ? 'enquiry' : 'confirmed';
      let room = null;
      if (flags.room) {
        room = await resolve(db, 'room', flags.room);
        if (room.room_type_id !== t.id && !flags.force) throw Error(`${room.name} is not a ${t.name}. Use --force to put them there anyway`);
        if (status === 'confirmed' && !(await freeRooms(db, null, arrive, depart)).some((r) => r.id === room.id)) throw Error(`${room.name} is not free from ${arrive} to ${depart}. Run availability`);
      } else if (status === 'confirmed') {
        const full = await typeHasRoom(db, t.id, arrive, depart);
        if (full.length && !flags.force) throw Error(`No ${t.name} left on ${full.join(', ')}. Run availability, or --force to overbook`);
      }
      const nights = await priceStay(db, t.id, arrive, depart, flags);
      const total = nights.reduce((n, x) => n + x.rate_cents, 0);
      // The channel collects for OTA bookings; direct bookings carry the house deposit unless told otherwise.
      const deposit = flags.deposit !== undefined && flags.deposit !== true ? toCents(flags.deposit, '--deposit')
        : channel?.kind === 'ota' ? 0 : Math.round(total * s.deposit_pct / 100);
      const due = deposit ? [addDays(now, s.deposit_days), arrive].sort()[0] : null;
      [result] = await db.query(`insert into bookings (ref, guest_id, room_type_id, room_id, channel_id, arrive_on, depart_on, adults, children, status, long_stay_agreed, deposit_cents, deposit_due_on, channel_ref, eta, requests)
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16) returning *`,
      [await nextNumber(db, 'bookings', 'ref', s.booking_prefix), guest.id, t.id, room?.id || null, channel?.id || null, arrive, depart, adults, children, status,
        !!flags.long_stay, deposit, due, flags.channel_ref || '', flags.eta || '', flags.requests || '']);
      await writeNights(db, result.id, nights);
      result = [{ ref: result.ref, status, guest: guest.name, room_type: t.name, room: room?.name || 'not assigned', arrive_on: arrive, depart_on: depart, nights: nights.length, total: fmt(total, s.currency), deposit: deposit ? `${fmt(deposit, s.currency)} due ${due}` : 'none' }];
    } else if (cmd === 'assign' || cmd === 'move') {
      const bk = await resolveBooking(db, a);
      if (!['confirmed', 'checked_in', 'enquiry'].includes(bk.status)) throw Error(`${bk.ref} is ${bk.status}`);
      const from = bk.status === 'checked_in' ? now : bk.arrive_on;
      const free = await freeRooms(db, null, from, bk.depart_on, bk.id);
      let room;
      if (b) {
        room = await resolve(db, 'room', b);
        if (!free.some((r) => r.id === room.id)) throw Error(`${room.name} is not free from ${from} to ${bk.depart_on}`);
        if (room.room_type_id !== bk.room_type_id && !flags.force) throw Error(`${room.name} is a different room type. Use --force to move them there (the rate stays as booked)`);
      } else {
        room = free.find((r) => r.room_type_id === bk.room_type_id);
        if (!room) throw Error(`No ${bk.room_type_id === null ? '' : 'room of that type '}free from ${from} to ${bk.depart_on}`);
      }
      const [was] = bk.room_id ? await db.query('select name from rooms where id = $1', [bk.room_id]) : [null];
      await db.query('update bookings set room_id = $1, room_type_id = $2 where id = $3', [room.id, flags.force ? room.room_type_id : bk.room_type_id, bk.id]);
      if (bk.status === 'checked_in' && was) await db.query("update rooms set status = 'dirty' where name = $1", [was.name]);
      result = [{ ref: bk.ref, guest: bk.guest, from_room: was?.name || 'not assigned', to_room: room.name, room_status: room.status }];
    } else if (cmd === 'change-dates') {
      const bk = await resolveBooking(db, a);
      if (!['confirmed', 'enquiry', 'checked_in'].includes(bk.status)) throw Error(`${bk.ref} is ${bk.status}`);
      const arrive = bk.status === 'checked_in' ? bk.arrive_on : isoDay(required(b, 'new check-in date'), 'check-in');
      const depart = departFrom(arrive, bk.status === 'checked_in' ? required(b, 'new check-out date or total nights') : c);
      if (bk.status === 'checked_in' && depart <= now) throw Error('Use check-out to end a stay today');
      if (bk.room_id && bk.status !== 'enquiry' && !(await freeRooms(db, null, arrive, depart, bk.id)).some((r) => r.id === bk.room_id)) throw Error(`The room is not free for ${arrive} to ${depart}. Move them first, or pick other dates`);
      if (!bk.room_id && bk.status !== 'enquiry') { const full = await typeHasRoom(db, bk.room_type_id, arrive, depart, bk.id); if (full.length && !flags.force) throw Error(`No room of that type left on ${full.join(', ')}`); }
      // Nights already slept keep their rate; new nights are priced today.
      const kept = await db.query('select night_on::text, rate_cents, rate_plan from booking_nights where booking_id = $1 and night_on >= $2 and night_on < $3', [bk.id, arrive, depart]);
      const priced = await priceStay(db, bk.room_type_id, arrive, depart, { ...flags, force: true });
      const nights = priced.map((n) => kept.find((k) => k.night_on === n.night_on) || n);
      await db.query('update bookings set arrive_on = $1, depart_on = $2 where id = $3', [arrive, depart, bk.id]);
      await writeNights(db, bk.id, nights);
      result = [{ ref: bk.ref, arrive_on: arrive, depart_on: depart, nights: nights.length, total: fmt(nights.reduce((n, x) => n + Number(x.rate_cents), 0), s.currency) }];
    } else if (cmd === 'check-in') {
      const bk = await resolveBooking(db, a);
      if (bk.status !== 'confirmed') throw Error(`${bk.ref} is ${bk.status}, not confirmed`);
      if (bk.arrive_on > now) throw Error(`${bk.ref} arrives ${bk.arrive_on}. Change the dates first for an early arrival`);
      let roomId = flags.room ? (await resolve(db, 'room', flags.room)).id : bk.room_id;
      if (!roomId) roomId = (await freeRooms(db, bk.room_type_id, now, bk.depart_on, bk.id))[0]?.id;
      if (!roomId) throw Error('No room of that type is free. Move another booking or upgrade with move --force');
      const [room] = await db.query('select * from rooms where id = $1', [roomId]);
      if (!(await freeRooms(db, null, now, bk.depart_on, bk.id)).some((r) => r.id === room.id)) throw Error(`${room.name} is not free until ${bk.depart_on}`);
      if (room.status === 'dirty' && !flags.force) throw Error(`${room.name} has not been cleaned. Mark it clean with room-status, or --force`);
      await db.query("update bookings set status = 'checked_in', room_id = $1, checked_in_at = now() where id = $2", [room.id, bk.id]);
      const f = await folio(db, bk.id);
      result = [{ ref: bk.ref, guest: bk.guest, room: room.name, departs: bk.depart_on, balance: fmt(f.balance_cents, s.currency) }];
    } else if (cmd === 'check-out') {
      const bk = await resolveBooking(db, a);
      if (bk.status !== 'checked_in') throw Error(`${bk.ref} is ${bk.status}, not checked in`);
      // Leaving early: nights from today on come off the bill. At least one night stays.
      if (now < bk.depart_on) {
        const depart = now > bk.arrive_on ? now : addDays(bk.arrive_on, 1);
        await db.query('delete from booking_nights where booking_id = $1 and night_on >= $2', [bk.id, depart]);
        await db.query('update bookings set depart_on = $1 where id = $2', [depart, bk.id]);
      }
      const f = await folio(db, bk.id);
      if (f.balance_cents > 0 && !flags.owing) throw Error(`${fmt(f.balance_cents, s.currency)} is owing on ${bk.ref}. Take it with pay, or check out with --owing`);
      await db.query("update bookings set status = 'checked_out', checked_out_at = now() where id = $1", [bk.id]);
      await db.query("update rooms set status = 'dirty' where id = $1", [bk.room_id]);
      await db.query("insert into housekeeping (room_id, kind, note) values ($1, 'dirty', $2)", [bk.room_id, `check-out ${bk.ref}`]);
      const after = await folio(db, bk.id);
      let [inv] = await db.query('select * from invoices where booking_id = $1', [bk.id]);
      if (!inv) [inv] = await db.query('insert into invoices (number, booking_id, total_cents, gst_cents) values ($1, $2, $3, $4) returning *', [await nextNumber(db, 'invoices', 'number', s.invoice_prefix), bk.id, after.total_cents, after.gst_cents]);
      result = [{ ref: bk.ref, guest: bk.guest, nights: after.nights, total: fmt(after.total_cents, s.currency), gst_included: fmt(after.gst_cents, s.currency), balance: fmt(after.balance_cents, s.currency), invoice: inv.number }];
    } else if (cmd === 'cancel' || cmd === 'no-show') {
      const bk = await resolveBooking(db, a);
      const allowed = cmd === 'cancel' ? ['enquiry', 'confirmed'] : ['confirmed'];
      if (!allowed.includes(bk.status)) throw Error(`${bk.ref} is ${bk.status}`);
      if (cmd === 'no-show' && bk.arrive_on > now) throw Error(`${bk.ref} is not due until ${bk.arrive_on}`);
      await db.query('update bookings set status = $1, cancelled_on = $2, cancel_reason = $3 where id = $4', [cmd === 'cancel' ? 'cancelled' : 'no_show', now, flags.reason || (cmd === 'no-show' ? 'did not arrive' : ''), bk.id]);
      if (flags.fee) await db.query("insert into charges (booking_id, kind, description, amount_cents) values ($1, 'cancellation', $2, $3)", [bk.id, cmd === 'cancel' ? 'Cancellation fee' : 'No-show fee', toCents(flags.fee, '--fee')]);
      const f = await folio(db, bk.id);
      result = [{ ref: bk.ref, guest: bk.guest, status: f.status, fee: fmt(f.extras_cents, s.currency), paid: fmt(f.paid_cents, s.currency), balance: fmt(f.balance_cents, s.currency), next: f.balance_cents < 0 ? 'refund the difference, or keep it as agreed in your terms' : f.balance_cents > 0 ? 'charge the card on file or send the fee request' : 'nothing owing' }];
    } else if (cmd === 'charge') {
      const bk = await resolveBooking(db, a);
      if (['enquiry'].includes(bk.status)) throw Error(`${bk.ref} is an enquiry; confirm it before charging`);
      const kind = flags.kind || 'extra';
      const amount = toCents(b, 'amount', { negative: kind === 'discount' });
      [result] = [await db.query('insert into charges (booking_id, kind, description, amount_cents, gst_applies) values ($1, $2, $3, $4, $5) returning posted_on, kind, description, round(amount_cents / 100.0, 2) amount',
        [bk.id, kind, required(c, 'description'), kind === 'discount' ? -Math.abs(amount) : amount, !flags.no_gst])];
    } else if (cmd === 'pay' || cmd === 'refund') {
      const bk = await resolveBooking(db, a);
      const amount = toCents(b, 'amount');
      if (!(amount > 0)) throw Error('Amount must be more than zero');
      const method = flags.method || 'card';
      await db.query('insert into payments (booking_id, kind, method, amount_cents, reference) values ($1, $2, $3, $4, $5)',
        [bk.id, cmd === 'refund' ? 'refund' : flags.deposit ? 'deposit' : 'payment', method, cmd === 'refund' ? -amount : amount, flags.reference || '']);
      const f = await folio(db, bk.id);
      if (cmd === 'refund' && f.paid_cents < 0) throw Error(`That refunds more than was paid (${fmt(f.paid_cents + amount, s.currency)})`);
      result = [{ ref: bk.ref, guest: bk.guest, [cmd === 'refund' ? 'refunded' : 'paid']: fmt(amount, s.currency), total: fmt(f.total_cents, s.currency), balance: fmt(f.balance_cents, s.currency) }];
    } else if (cmd === 'room-status') {
      const room = await resolve(db, 'room', a);
      const status = required(b, 'clean, dirty, inspected or out_of_order').replace('-', '_');
      if (!['clean', 'dirty', 'inspected', 'out_of_order'].includes(status)) throw Error('Status must be clean, dirty, inspected or out_of_order');
      if (status === 'out_of_order') {
        required(flags.reason, '--reason for taking the room out of order');
        if ((await db.query("select 1 from bookings where room_id = $1 and status = 'checked_in'", [room.id])).length && !flags.force) throw Error(`${room.name} has a guest in it. Move them first, or --force`);
      }
      await db.query('update rooms set status = $1, out_of_order_reason = $2, out_of_order_until = $3 where id = $4',
        [status, status === 'out_of_order' ? flags.reason : '', status === 'out_of_order' ? isoDay(flags.until, '--until') : null, room.id]);
      await db.query('insert into housekeeping (room_id, kind, done_by, note) values ($1, $2, $3, $4)',
        [room.id, status === 'out_of_order' ? 'out_of_order' : room.status === 'out_of_order' ? 'back_in_service' : status === 'inspected' ? 'inspect' : status, flags.by || '', flags.reason || '']);
      const hit = status === 'out_of_order' ? await db.query("select ref from v_live where room_id = $1 and status = 'confirmed' and depart_on > $2 and arrive_on <= coalesce($3::date, $2::date + 30) order by arrive_on", [room.id, now, isoDay(flags.until, '--until')]) : [];
      result = [{ room: room.name, status, bookings_to_move: hit.map((h) => h.ref).join(', ') || 'none' }];
    } else if (cmd === 'night-audit') {
      // End of day: stayovers need a service tomorrow, no-shows are listed for a decision, tonight's numbers are recorded.
      const stay = await db.query("update rooms set status = 'dirty' where id in (select room_id from bookings where status = 'checked_in' and depart_on > $1) and status <> 'out_of_order' returning name", [now]);
      const [night] = await db.query(`select count(*) filter (where status = 'checked_in') in_house, (select count(*) from rooms where active) rooms,
        coalesce(sum(n.rate_cents) filter (where status = 'checked_in'), 0) revenue
        from bookings b left join booking_nights n on n.booking_id = b.id and n.night_on = $1 where b.status = 'checked_in'`, [now]);
      const noShows = await db.query("select ref from bookings where status = 'confirmed' and arrive_on <= $1", [now]);
      const [tomorrow] = await db.query("select count(*) n from bookings where status = 'confirmed' and arrive_on = $1", [addDays(now, 1)]);
      result = [{ night: now, in_house: Number(night.in_house), occupancy_pct: Math.round(1000 * night.in_house / night.rooms) / 10, room_revenue: fmt(night.revenue, s.currency),
        stayover_rooms_marked_dirty: stay.length, not_arrived: noShows.map((x) => x.ref).join(', ') || 'none', arrivals_tomorrow: Number(tomorrow.n) }];
    } else if (cmd === 'log') {
      const note = required(b, 'note');
      let target = null;
      for (const [kind, fn] of [['booking', () => resolveBooking(db, a)], ['guest', () => resolve(db, 'guest', a)], ['room', () => resolve(db, 'room', a)]]) {
        try { target = { kind, rec: await fn() }; break; } catch (e) { if (/Ambiguous/.test(e.message)) throw e; }
      }
      if (!target) throw Error(`No booking, guest or room matches "${a}"`);
      result = await db.query(`insert into notes (${target.kind}_id, note) values ($1, $2) returning *`, [target.rec.id, note]);
    }
    await audit(db, cmd, result?.[0]?.id && /^[0-9a-f-]{36}$/.test(result[0].id) ? result[0].id : null, { args: pos.slice(1), flags });
    await db.exec(cmd === 'import' && !flags.apply ? 'ROLLBACK' : 'COMMIT');
    return result;
  } catch (e) {
    await db.exec('ROLLBACK');
    throw e;
  }
}

// Drafts to drafts/. Nothing here sends.
async function draft(db, cmd, who, flags) {
  const s = await settingsOf(db);
  const name = s.business_name.replace(/ \(demo\)$/, '');
  const one = async (bk) => {
    const f = await folio(db, bk.id);
    const [g] = await db.query('select * from guests where id = $1', [bk.guest_id]);
    const first = g.name.split(' ')[0];
    const stay = `${f.room_type}, ${f.arrive_on} to ${f.depart_on} (${f.nights} night${f.nights === 1 ? '' : 's'})`;
    const to = g.email ? `${g.name} <${g.email}>` : `${g.name} (no email on file)`;
    const head = (title, subject) => [`# ${title}: ${bk.ref}`, '', 'For review. Nothing has been sent.', '', `To: ${to}`, `Subject: ${subject}`, ''];
    let body;
    if (cmd === 'draft-confirmation') {
      body = [...head('Draft booking confirmation', `Your booking at ${name}, ${f.arrive_on}`), `Kia ora ${first},`, '', `Thanks for booking with us. Your stay is confirmed: ${stay}, for ${f.adults} adult${f.adults === 1 ? '' : 's'}${f.children ? ` and ${f.children} child${f.children === 1 ? '' : 'ren'}` : ''}.`, '',
        `Total: ${fmt(f.total_cents, s.currency)} including GST.`, f.deposit_cents > 0 && f.paid_cents < f.deposit_cents ? `A deposit of ${fmt(f.deposit_cents, s.currency)} is due by ${f.deposit_due_on}.` : `Paid so far: ${fmt(f.paid_cents, s.currency)}.`, '',
        `Your booking reference is ${bk.ref}. Reply to this email if anything changes.`, '', 'Nga mihi,', `[your name], ${name}`, ''];
    } else if (cmd === 'draft-prearrival') {
      body = [...head('Draft pre-arrival note', `See you soon at ${name}`), `Kia ora ${first},`, '', `We are looking forward to having you on ${f.arrive_on}: ${stay}.`, '',
        'Check-in is from [time]. If you will arrive after [time], let us know and we will leave your key at [place].', f.balance_cents > 0 ? `The balance of ${fmt(f.balance_cents, s.currency)} is payable on arrival.` : 'Your stay is paid in full.', '',
        'Reply with your arrival time and anything you need for the stay.', '', 'Nga mihi,', `[your name], ${name}`, ''];
    } else if (cmd === 'draft-deposit-reminder') {
      const owing = f.deposit_cents - Math.max(f.paid_cents, 0);
      if (owing <= 0) throw Error(`${bk.ref} has paid its deposit`);
      body = [...head('Draft deposit reminder', `Deposit for your stay at ${name}`), `Kia ora ${first},`, '', `Just a reminder that the deposit of ${fmt(owing, s.currency)} for your stay (${stay}) was due on ${f.deposit_due_on}.`, '',
        'You can pay by [payment link or bank account]. Please use your booking reference ' + bk.ref + '.', '', 'If your plans have changed, reply and we will sort it out.', '', 'Nga mihi,', `[your name], ${name}`, ''];
    } else if (cmd === 'draft-review-request') {
      if (f.status !== 'checked_out') throw Error(`${bk.ref} has not checked out`);
      body = [...head('Draft thank-you and review request', `Thanks for staying at ${name}`), `Kia ora ${first},`, '', `Thanks for staying with us${f.nights > 1 ? ` for ${f.nights} nights` : ''}. We hope the room was comfortable.`, '',
        'If you have a minute, a short review helps other travellers find us: [review link].', '', 'Next time, book direct with us and quote this email for our returning-guest rate.', '', 'Nga mihi,', `[your name], ${name}`, ''];
    }
    return { ref: bk.ref, guest: g.name, file: await writeDraft(`${cmd.slice(6)}-${bk.ref}`, body.join('\n')), status: 'draft' };
  };
  if (cmd === 'draft-prearrival' && !who) {
    const days = Number(flags.days || 2);
    const due = await db.query("select b.*, g.name guest from bookings b join guests g on g.id = b.guest_id where b.status = 'confirmed' and b.arrive_on between hotel_today() and hotel_today() + $1::int order by b.arrive_on", [days]);
    const out = [];
    for (const bk of due) out.push(await one(bk));
    return out;
  }
  return [await one(await resolveBooking(db, who))];
}

const HIDE = new Set(['source_data', 'created_at', 'updated_at', 'raw']);
export function format(value) {
  if (Array.isArray(value)) {
    if (!value.length) return '  (none)';
    const cols = Object.keys(value[0]).filter((k) => !HIDE.has(k));
    const rows = value.map((r) => Object.fromEntries(cols.map((k) => {
      const v = r[k];
      return [k, v instanceof Date ? v.toISOString().slice(0, 10) : v && typeof v === 'object' ? JSON.stringify(v) : v];
    })));
    return table(rows, cols.map((k) => ({ key: k, label: k.replaceAll('_', ' '), width: k === 'id' || k.endsWith('_id') ? 8 : 70 })));
  }
  return Object.entries(value).map(([k, v]) => `${k.toUpperCase()}\n${format(Array.isArray(v) ? v : [v])}`).join('\n\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  let db;
  try {
    db = await getDb();
    const result = await run(db, process.argv.slice(2));
    console.log(process.argv.includes('--json') ? JSON.stringify(result, null, 2) : format(result));
  } catch (e) {
    console.error(e.message);
    process.exitCode = 1;
  } finally {
    await db?.close();
  }
}
