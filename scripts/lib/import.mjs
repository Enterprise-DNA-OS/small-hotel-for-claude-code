// Bring bookings across from Little Hotelier, and keep outside calendars (Airbnb, Booking.com, Vrbo) in step.
//   little-hotelier  the reservations CSV from Little Hotelier's reservation search or reservation report export.
//                    Column names differ between reports, so each field accepts several names (see docs/replace-little-hotelier.md).
//   ical             an .ics calendar file or feed saved to disk, for one room: its events become blocks on that room.
// A dry run by default: everything runs inside the caller's transaction, which rolls back unless --apply.
// Every original row is kept in import_rows and source_data. Running the same file twice adds nothing.
import fs from 'node:fs';
import { parseCsv, pick } from './csv.mjs';

const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };

const monthOf = (w) => MONTHS[w.toLowerCase().slice(0, 4)] || MONTHS[w.toLowerCase().slice(0, 3)];

export function toDate(v, order, what) {
  const s = String(v ?? '').trim();
  if (!s) return null;
  let m, y, mo, d;
  if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) [, y, mo, d] = m.map(Number);
  else if ((m = s.match(/^(\d{1,2})[ -]([A-Za-z]{3,9})[ ,-]*(\d{4})/)) && monthOf(m[2])) [d, mo, y] = [Number(m[1]), monthOf(m[2]), Number(m[3])];
  else if ((m = s.match(/^([A-Za-z]{3,9}) (\d{1,2}),? (\d{4})/)) && monthOf(m[1])) [mo, d, y] = [monthOf(m[1]), Number(m[2]), Number(m[3])];
  else if ((m = s.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{2,4})/))) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    y = Number(m[3]) < 100 ? 2000 + Number(m[3]) : Number(m[3]);
    let o = order;
    if (!o) { if (a > 12) o = 'dmy'; else if (b > 12) o = 'mdy'; else throw Error(`${what}: "${s}" could be day-first or month-first. Rerun with --date-order=dmy or --date-order=mdy`); }
    [d, mo] = o === 'dmy' ? [a, b] : [b, a];
  } else throw Error(`${what}: "${s}" is not a date`);
  const iso = `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  if (Number.isNaN(Date.parse(`${iso}T00:00:00Z`)) || new Date(`${iso}T00:00:00Z`).toISOString().slice(0, 10) !== iso) throw Error(`${what}: "${s}" is not a real date`);
  return iso;
}

function cents(v, what) {
  const s = String(v ?? '').replace(/[^0-9.-]/g, '');
  if (!s) return 0;
  const n = Number(s);
  if (!Number.isFinite(n)) throw Error(`${what}: "${v}" is not an amount`);
  return Math.round(n * 100);
}

const statusOf = (t) => {
  const s = String(t || '').toLowerCase();
  if (/cancel/.test(s)) return 'cancelled';
  if (/no.?show/.test(s)) return 'no_show';
  if (/checked.?out|departed|completed/.test(s)) return 'checked_out';
  if (/checked.?in|in.?house|arrived/.test(s)) return 'checked_in';
  if (/enquir|inquir|tentative|pending|provisional/.test(s)) return 'enquiry';
  return 'confirmed';
};
const channelKind = (name) => {
  const s = String(name || '').toLowerCase();
  if (/walk/.test(s)) return 'walk-in';
  if (/booking engine|direct|website|phone|email|front desk|little hotelier/.test(s)) return 'direct';
  if (/agent|travel|wholesal|tour/.test(s)) return 'agent';
  if (/corporate|account|company/.test(s)) return 'corporate';
  return 'ota';
};

async function seen(db, entity, sourceId) {
  return (await db.query('select record_id from import_rows where entity = $1 and source_id = $2', [entity, sourceId]))[0]?.record_id || null;
}
async function remember(db, entity, sourceId, recordId, raw) {
  await db.query('insert into import_rows (entity, source_id, record_id, raw) values ($1, $2, $3, $4)', [entity, sourceId, recordId, JSON.stringify(raw)]);
}

export async function importLittleHotelier(db, file, flags = {}) {
  if (!file || !fs.existsSync(file)) throw Error(`No file at ${file}`);
  const order = flags.date_order;
  if (order && !['dmy', 'mdy'].includes(order)) throw Error('--date-order must be dmy or mdy');
  const rows = parseCsv(fs.readFileSync(file, 'utf8'));
  const out = { mode: flags.apply ? 'applied' : 'dry-run', rows: rows.length, inserted: 0, existing: 0, guests_created: 0, room_types_created: 0, channels_created: 0, unassigned: 0, masked_guests: 0, notes: [] };
  const [settings] = await db.query('select * from settings');
  const newChannels = new Set();

  for (const [i, row] of rows.entries()) {
    const line = i + 2;
    const ref = pick(row, 'Reservation ID', 'Booking Reference', 'Booking Ref', 'Booking ID', 'Reservation Number', 'Confirmation Number', 'Booking Number', 'ID');
    if (!ref) throw Error(`Row ${line}: no reservation ID column (Reservation ID, Booking Reference, ...)`);
    if (await seen(db, 'reservation', ref)) { out.existing++; continue; }
    if ((await db.query('select 1 from bookings where ref = $1 or external_id = $2', [ref, `lh:${ref}`])).length) { out.existing++; continue; }

    const arrive = toDate(pick(row, 'Check In', 'Check-in', 'Check In Date', 'Check-In Date', 'Arrival', 'Arrival Date', 'Check in date'), order, `Row ${line} check-in`);
    const depart = toDate(pick(row, 'Check Out', 'Check-out', 'Check Out Date', 'Check-Out Date', 'Departure', 'Departure Date', 'Check out date'), order, `Row ${line} check-out`);
    if (!arrive || !depart) throw Error(`Row ${line}: check-in and check-out dates are required`);
    if (depart <= arrive) throw Error(`Row ${line}: check-out ${depart} is not after check-in ${arrive}`);

    // Guest. Little Hotelier masks guest details 180 days after check-out.
    let name = pick(row, 'Guest Name', 'Guest', 'Name', 'Booker', 'Customer', 'Customer Name');
    if (!name) name = [pick(row, 'Guest First Name', 'First Name', 'Firstname'), pick(row, 'Guest Last Name', 'Last Name', 'Surname', 'Lastname')].filter(Boolean).join(' ');
    const email = pick(row, 'Email', 'Guest Email', 'Email Address', 'E-mail');
    const phone = pick(row, 'Phone', 'Guest Phone', 'Phone Number', 'Mobile', 'Telephone');
    const masked = !name || /\*{3,}/.test(name);
    if (masked) { out.masked_guests++; name = `Masked guest ${ref}`; }
    let guestId = null;
    if (!masked && email) guestId = (await db.query("select id from guests where lower(email) = lower($1) and email <> '' limit 1", [email]))[0]?.id;
    if (!guestId && !masked) guestId = (await db.query('select id from guests where lower(name) = lower($1) and (phone = $2 or $2 = \'\') limit 1', [name, phone]))[0]?.id;
    if (!guestId) {
      guestId = (await db.query('insert into guests (name, email, phone, address, country, source_data) values ($1, $2, $3, $4, $5, $6) returning id',
        [name, masked ? '' : email, masked ? '' : phone, pick(row, 'Address', 'Guest Address'), pick(row, 'Country', 'Guest Country'), JSON.stringify({ little_hotelier: ref })]))[0].id;
      out.guests_created++;
    }

    // Room type and room.
    const typeName = pick(row, 'Room Type', 'Room Type Name', 'Room Category', 'Room') || 'Imported room';
    const roomName = pick(row, 'Room Number', 'Room Name', 'Room No', 'Unit', 'Room Number(s)', 'Room');
    const nights = (Date.parse(depart) - Date.parse(arrive)) / 86400000;
    const total = cents(pick(row, 'Total', 'Total Amount', 'Total Price', 'Booking Total', 'Grand Total', 'Amount', 'Accommodation Total'), `Row ${line} total`);
    let [type] = await db.query('select id from room_types where lower(name) = lower($1)', [typeName]);
    if (!type) {
      [type] = await db.query('insert into room_types (name, base_rate_cents) values ($1, $2) returning id', [typeName, Math.round(total / nights)]);
      out.room_types_created++;
    }
    let roomId = null;
    if (roomName) roomId = (await db.query('select id from rooms where lower(name) = lower($1)', [roomName]))[0]?.id || null;
    if (!roomId) out.unassigned++;

    // Channel.
    const channelName = pick(row, 'Channel', 'Channel Name', 'Source', 'Booking Source', 'Booking Channel') || 'Little Hotelier';
    let [channel] = await db.query('select id from channels where lower(name) = lower($1)', [channelName]);
    if (!channel) {
      [channel] = await db.query('insert into channels (name, kind) values ($1, $2) returning id', [channelName, channelKind(channelName)]);
      out.channels_created++;
      newChannels.add(channelName);
    }

    const status = statusOf(pick(row, 'Status', 'Booking Status', 'Reservation Status', 'State'));
    const booked = toDate(pick(row, 'Booked On', 'Booking Date', 'Date Booked', 'Created', 'Created Date', 'Created At', 'Booked'), order, `Row ${line} booked date`) || arrive;
    const adults = Number(pick(row, 'Adults', 'Number of Adults', 'No. of Adults', 'Guests') || 2) || 2;
    const children = Number(pick(row, 'Children', 'Number of Children', 'No. of Children') || 0) || 0;
    const [b] = await db.query(
      `insert into bookings (ref, guest_id, room_type_id, room_id, channel_id, arrive_on, depart_on, adults, children, status, booked_on, channel_ref, requests,
         cancelled_on, checked_in_at, checked_out_at, external_id, source_data)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18) returning id`,
      [ref, guestId, type.id, roomId, channel.id, arrive, depart, adults, children, status, booked, pick(row, 'Channel Reference', 'Channel Booking ID', 'OTA Reference', 'Channel Ref'),
        pick(row, 'Notes', 'Special Requests', 'Guest Comments', 'Comments'), status === 'cancelled' ? booked : null,
        ['checked_in', 'checked_out'].includes(status) ? arrive : null, status === 'checked_out' ? depart : null, `lh:${ref}`, JSON.stringify(row)]);
    // The total spread over the nights; the last night carries the rounding.
    const each = Math.floor(total / nights);
    for (let n = 0; n < nights; n++) {
      const night = new Date(Date.parse(`${arrive}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
      await db.query("insert into booking_nights (booking_id, night_on, rate_cents, rate_plan) values ($1, $2, $3, 'Little Hotelier import')", [b.id, night, n === nights - 1 ? total - each * (nights - 1) : each]);
    }
    const paid = cents(pick(row, 'Amount Paid', 'Paid', 'Payment Received', 'Payments', 'Total Paid'), `Row ${line} amount paid`);
    if (paid > 0) await db.query("insert into payments (booking_id, paid_on, kind, method, amount_cents, reference) values ($1, $2, 'payment', 'other', $3, 'Little Hotelier import')", [b.id, booked, paid]);
    await remember(db, 'reservation', ref, b.id, row);
    out.inserted++;
  }
  if (out.unassigned) out.notes.push(`${out.unassigned} booking(s) have no room matched by name: assign them, or add the rooms first and rerun on a fresh database`);
  if (out.masked_guests) out.notes.push(`${out.masked_guests} guest(s) were masked by Little Hotelier (it masks guest details 180 days after check-out)`);
  if (newChannels.size) out.notes.push(`New channels ${[...newChannels].join(', ')}: set each commission with set channel <name> --commission-pct=`);
  out.notes.push(`Totals are spread evenly across the nights, in ${settings.currency}. Payments come across as one line per booking`);
  return [out];
}

// iCal: unfold lines, read each VEVENT's UID, SUMMARY, DTSTART and DTEND (all-day or date-time).
export function parseIcal(text) {
  const lines = String(text).replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '').split(/\r?\n/);
  const events = [];
  let ev = null;
  const day = (v) => { const m = String(v || '').match(/(\d{4})(\d{2})(\d{2})/); return m ? `${m[1]}-${m[2]}-${m[3]}` : null; };
  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') ev = {};
    else if (line === 'END:VEVENT') { if (ev) events.push(ev); ev = null; }
    else if (ev) {
      const i = line.indexOf(':');
      if (i < 0) continue;
      const key = line.slice(0, i).split(';')[0].toUpperCase();
      const value = line.slice(i + 1);
      if (key === 'UID') ev.uid = value;
      if (key === 'SUMMARY') ev.summary = value.replace(/\\,/g, ',').replace(/\\n/g, ' ');
      if (key === 'DTSTART') ev.start = day(value);
      if (key === 'DTEND') ev.end = day(value);
    }
  }
  if (!/BEGIN:VCALENDAR/.test(text)) throw Error('Not an iCal file: no BEGIN:VCALENDAR');
  return events.filter((e) => e.start).map((e) => ({ ...e, end: e.end && e.end > e.start ? e.end : new Date(Date.parse(`${e.start}T00:00:00Z`) + 86400000).toISOString().slice(0, 10), uid: e.uid || `${e.start}:${e.end}` }));
}

export async function importIcal(db, room, file, flags = {}) {
  if (!file || !fs.existsSync(file)) throw Error(`No file at ${file}`);
  const source = String(flags.source || 'ical').toLowerCase();
  if (['manual', 'owner'].includes(source)) throw Error('--source names the outside calendar, for example airbnb or bookingcom');
  const events = parseIcal(fs.readFileSync(file, 'utf8'));
  const out = { mode: flags.apply ? 'applied' : 'dry-run', room: room.name, source, events: events.length, inserted: 0, updated: 0, removed: 0, unchanged: 0 };
  const uids = [];
  for (const e of events) {
    uids.push(e.uid);
    const [had] = await db.query('select * from blocks where room_id = $1 and source = $2 and uid = $3', [room.id, source, e.uid]);
    if (!had) { await db.query('insert into blocks (room_id, starts_on, ends_on, source, uid, summary) values ($1, $2, $3, $4, $5, $6)', [room.id, e.start, e.end, source, e.uid, e.summary || '']); out.inserted++; }
    else if (had.starts_on !== e.start || had.ends_on !== e.end) { await db.query('update blocks set starts_on = $1, ends_on = $2, summary = $3 where id = $4', [e.start, e.end, e.summary || '', had.id]); out.updated++; }
    else out.unchanged++;
  }
  // The feed is the truth for its own future dates: a block it no longer lists was cancelled there.
  const gone = await db.query('delete from blocks where room_id = $1 and source = $2 and ends_on >= hotel_today() and not (uid = any($3::text[])) returning id', [room.id, source, uids]);
  out.removed = gone.length;
  return [out];
}

// The calendar to give Airbnb or Booking.com for one room: live bookings, owner and manual blocks, out-of-order dates.
// Guest names never leave the building: every event is "Not available".
export async function icalFor(db, room, flags = {}) {
  const exclude = String(flags.exclude_source || '').toLowerCase();
  const busy = await db.query(`select 'b-' || id uid, arrive_on s, depart_on e from bookings where room_id = $1 and status in ('confirmed', 'checked_in') and depart_on >= hotel_today()
    union all select 'k-' || id, starts_on, ends_on from blocks where room_id = $1 and ends_on >= hotel_today() and source <> $2
    union all select 'o-' || id, hotel_today(), coalesce(out_of_order_until, hotel_today()) + 1 from rooms
      where id = $1 and status = 'out_of_order' and coalesce(out_of_order_until, hotel_today()) >= hotel_today()
    order by 2`, [room.id, exclude]);
  const d = (v) => String(v).replaceAll('-', '');
  const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Small Hotel for Claude Code//EN', 'CALSCALE:GREGORIAN',
    ...busy.flatMap((x) => ['BEGIN:VEVENT', `UID:${x.uid}@small-hotel`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${d(x.s)}`, `DTEND;VALUE=DATE:${d(x.e)}`, 'SUMMARY:Not available', 'END:VEVENT']),
    'END:VCALENDAR', ''].join('\r\n');
}
