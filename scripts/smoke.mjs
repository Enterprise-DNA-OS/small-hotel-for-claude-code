#!/usr/bin/env node
// npm test: a throwaway database, the migration, the demo motel, then every report and action
// with assertions on the rules that matter. Needs no secrets. Runs on Windows and Linux.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { getDb, REPO_ROOT } from './lib/db.mjs';
import { migrate } from './migrate.mjs';
import { seed } from './seed.mjs';
import { run, actions } from './hotel.mjs';
import { reports } from './lib/domain.mjs';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hotel-test-'));
process.env.DATA_DIR = path.join(dir, 'db');
process.env.DATABASE_URL = '';
process.env.OUTPUT_DIR = dir;

let db, checks = 0;
const seen = new Set();
const eq = (a, b, msg) => { assert.deepEqual(a, b, msg); checks++; };
const ok = (v, msg) => { assert.ok(v, msg); checks++; };
const call = async (...args) => { seen.add(args[0]); return run(db, args); };
const reject = async (args, re) => { seen.add(args[0]); await assert.rejects(() => run(db, args), re); checks++; };
const find = (rows, key, value) => rows.find((r) => r[key] === value);
const one = async (sql, params = []) => (await db.query(sql, params))[0];
const cli = (...args) => spawnSync(process.execPath, ['scripts/hotel.mjs', ...args], { cwd: REPO_ROOT, env: process.env, encoding: 'utf8' });

try {
  db = await getDb();
  eq((await migrate(db)).ran, ['0001_small_hotel.sql']);
  eq((await migrate(db)).ran.length, 0);
  await seed(db);
  const count = (await one('select count(*)::int n from bookings')).n;
  await seed(db);
  eq((await one('select count(*)::int n from bookings')).n, count, 'seed is idempotent');
  ok(count > 300, 'six months of history loaded');
  const today = (await one('select hotel_today()::text d')).d;
  const day = (n) => new Date(Date.parse(`${today}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
  for (const name of Object.keys(reports)) ok(Array.isArray(await call(name)), `${name} returns rows`);
  ok((await call('help'))[0].actions.includes('night-audit'));

  // The front desk's day: what needs a decision, which rooms to clean first, who arrives.
  const reasons = (await call('attention')).map((r) => r.reason);
  for (const r of ['arriving with no room', 'double booked', 'no-show?', 'balance owing at departure', 'departed owing', 'deposit overdue', 'no tax invoice', 'enquiry gone quiet', 'room not ready', 'out of order past its date']) ok(reasons.includes(r), `attention shows ${r}`);
  eq(find(await call('housekeeping'), 'room', 'Unit 2').housekeeping, 'clean now: guest arriving', 'the dirty room with an arrival comes first');
  eq((await call('housekeeping'))[0].room, 'Unit 2');
  eq((await call('arrivals')).map((r) => r.ref), ['K-1005', 'K-1004', 'K-1006']);
  eq((await call('conflicts')).length, 2, 'one double booking and one clash with the Airbnb calendar');

  // Compliance: long-stay GST, invoice details, privacy, card numbers.
  const rules = (await call('compliance')).map((r) => r.rule);
  for (const rule of ['NZ-LONG-STAY-GST', 'NZ-INVOICE-OVER-1000', 'PRIVACY-RETENTION', 'CARD-DATA', 'DOUBLE-BOOKING']) ok(rules.includes(rule), `compliance finds ${rule}`);
  ok(!rules.includes('GST-NUMBER'), 'the demo has a GST number');
  const contractors = await one("select gst_cents, reduced_nights, total_cents from v_folio where ref = 'K-1003'");
  eq([Number(contractors.reduced_nights), Number(contractors.gst_cents)], [17, 126983], 'nights 29 to 45 carry GST on 60% of the value');
  const walkIn = await one("select gst_cents from v_folio where ref = 'K-1010'");
  eq(Number(walkIn.gst_cents), 23646, 'a short stay carries the full 15%');

  // Occupancy, channels and the books ahead.
  const occ = await call('occupancy');
  ok(occ.filter((m) => !m.on_books && Number(m.occupancy_pct) > 30).length >= 5, 'five past months with real occupancy');
  const mix = await call('channel-mix');
  const bdc = find(mix, 'channel', 'Booking.com');
  eq(Number(bdc.commission), Math.round(Number(bdc.revenue) * 15) / 100, 'commission at the channel rate');
  ok(Number(find(mix, 'channel', 'Direct website').commission) === 0);
  eq((await call('forecast')).length, 12);
  ok((await call('pickup')).length > 0);
  ok((await call('repeat-guests')).every((g) => Number(g.stays) > 1));
  const grid = await call('availability', `--from=${day(0)}`, '--nights=7');
  eq(grid.length, 3);
  eq(Object.keys(grid[0]).length, 8, 'room type and seven nights');

  // Names: exact, fragment, ambiguous, missing.
  await reject(['booking', 'nobody at all'], /No booking matches/);
  await reject(['room-status', 'Unit 1', 'clean', '--by=x', '--until'], /needs a value/);
  await reject(['room-status', 'Unit', 'clean'], /Ambiguous room "Unit"\. Candidates:/);
  eq((await call('booking', 'grace')).booking[0].ref, 'K-1010');
  eq((await call('guest', 'ruth')).stays[0].ref, 'K-1003');

  // Quote and book.
  await reject(['quote', 'Two-bedroom', day(1), '1'], /at least 2 nights/);
  const q = await call('quote', 'Studio', day(20), '3');
  eq(q.quote[0].total, 'NZD 537.00', 'three spring nights at 179');
  const booked = (await call('book', 'Kiri Walker', 'Studio', day(40), '3', '--email=kiri@example.com', '--requests=Ground floor'))[0];
  eq([booked.ref, booked.status, booked.total], ['K-1015', 'confirmed', 'NZD 537.00']);
  eq(booked.deposit, `NZD 107.40 due ${day(7)}`, '20% deposit, due in seven days');
  const kiri = await one("select * from v_bookings where ref = 'K-1015'");
  eq(kiri.guest, 'Kiri Walker');
  const ota = (await call('book', 'Kiri Walker', 'Studio', day(50), day(52), '--channel=Booking.com', '--channel-ref=BDC-1'))[0];
  eq(ota.deposit, 'none', 'the channel collects on an OTA booking');
  eq((await one("select count(*)::int n from guests where name = 'Kiri Walker'")).n, 1, 'the second booking reuses the guest');
  await reject(['book', 'Late Guest', 'Studio', day(-3), '2'], /in the past/);
  await reject(['book', 'Chloe Twin', 'One-bedroom', day(5), '3', '--room=Unit 6'], /not free/);
  await reject(['book', 'Big Family', 'Studio', day(60), '2', '--adults=4'], /sleeps 2/);
  await call('set', 'guest', 'Kiri Walker', '--do-not-rebook=true', '--notes=Left the unit damaged');
  await reject(['book', 'Kiri Walker', 'Studio', day(70), '2'], /do not rebook/);
  const enquiry = (await call('book', 'Pat Lee', 'One-bedroom', day(30), '2', '--enquiry'))[0];
  eq(enquiry.status, 'enquiry');

  // Rooms: assign the unassigned, move a double booking, take a room out and bring it back.
  const assigned = (await call('assign', 'K-1005'))[0];
  eq(assigned.to_room, 'Unit 6', 'the inspected room goes first');
  const moved = (await call('move', 'K-1013'))[0];
  ok(moved.to_room !== 'Unit 6', 'the double booking moves to a free unit');
  await reject(['assign', 'K-1006', 'Unit 2'], /not free/);
  await reject(['room-status', 'Unit 3', 'out_of_order'], /--reason/);
  await reject(['room-status', 'Unit 5', 'out_of_order', '--reason=Leak'], /has a guest/);
  await call('room-status', 'Unit 8', 'clean', '--by=Mere');
  ok(!(await call('attention')).some((r) => r.reason === 'out of order past its date'), 'Unit 8 back in service');
  eq((await one("select kind from housekeeping where room_id = '22222222-0000-4000-8000-000000000008' order by created_at desc limit 1")).kind, 'back_in_service');

  // Arrive, charge, pay, leave.
  await reject(['check-in', 'K-1004'], /not been cleaned/);
  await call('room-status', 'Unit 2', 'inspected', '--by=Mere');
  eq((await call('check-in', 'K-1004'))[0].room, 'Unit 2');
  await reject(['check-in', 'K-1004'], /checked_in, not confirmed/);
  await reject(['check-in', 'K-1015'], /arrives/);
  eq((await call('check-in', 'K-1005'))[0].room, 'Unit 6');
  await call('charge', 'K-1004', '12.50', 'Late checkout');
  await call('charge', 'K-1004', '5', 'Returning guest', '--kind=discount');
  eq(Number((await one("select extras_cents from v_bookings where ref = 'K-1004'")).extras_cents), 750);
  await reject(['check-out', 'K-1001'], /NZD 30.00 is owing/);
  eq((await call('pay', 'K-1001', '30', '--method=eftpos'))[0].balance, 'NZD 0.00');
  const out = (await call('check-out', 'K-1001'))[0];
  eq([out.invoice, out.balance, out.total], ['INV-1002', 'NZD 0.00', 'NZD 428.00']);
  eq((await one("select status from rooms where name = 'Unit 1'")).status, 'dirty', 'a departure leaves the room to clean');
  await reject(['check-out', 'K-1001'], /checked_out/);
  // Leaving a night early takes the nights left off the bill.
  const early = (await call('check-out', 'K-1002', '--owing'))[0];
  eq(early.nights, 1, 'Hamish leaves after one of three nights');
  eq(early.balance, 'NZD -518.00', 'paid for three by the channel: the difference shows as owed back');
  ok((await call('balances')).some((r) => r.ref === 'K-1002'));
  await call('refund', 'K-1002', '518', '--method=channel', '--reference=BDC adjustment');
  eq(Number((await one("select balance_cents from v_bookings where ref = 'K-1002'")).balance_cents), 0);
  await reject(['refund', 'K-1002', '5000'], /refunds more than was paid/);

  // Dates change; nights already slept keep their rate.
  const longer = (await call('change-dates', 'K-1003', day(12)))[0];
  eq(longer.nights, 47);
  eq(Number((await one("select rate_cents from booking_nights where night_on = $1 and booking_id = '55555555-0000-4000-8000-000000000003'", [day(-10)])).rate_cents), 25000, 'the contract rate stays on slept nights');
  await reject(['change-dates', 'K-1003', day(0)], /check-out/);
  const shifted = (await call('change-dates', 'K-1015', day(41), '2'))[0];
  eq([shifted.arrive_on, shifted.nights], [day(41), 2]);

  // Cancellations, no-shows and deposits.
  const ns = (await call('no-show', 'K-1007', '--fee=199'))[0];
  eq([ns.status, ns.balance], ['no_show', 'NZD 199.00']);
  await reject(['no-show', 'K-1015'], /not due/);
  eq((await call('cancel', 'Pat Lee', '--reason=Booked elsewhere'))[0].status, 'cancelled');
  await reject(['cancel', 'K-1001'], /checked_out/);
  eq((await call('pay', 'K-1008', '279.20', '--deposit', '--method=bank'))[0].balance, 'NZD 1116.80');
  eq(find(await call('deposits'), 'ref', 'K-1008').state, 'paid');
  ok(!(await call('attention')).some((r) => r.reason === 'deposit overdue'));
  ok((await call('cancellations')).some((r) => r.ref === 'K-1007'));

  // Drafts only. Nothing sends.
  const conf = (await call('draft-confirmation', 'K-1015'))[0];
  const text = fs.readFileSync(conf.file, 'utf8');
  ok(text.includes('Nothing has been sent') && text.includes('Kiri Walker <kiri@example.com>') && text.includes('K-1015'));
  ok(fs.readFileSync((await call('draft-review-request', 'K-1001'))[0].file, 'utf8').includes('Emma'));
  await reject(['draft-review-request', 'K-1003'], /not checked out/);
  await reject(['draft-deposit-reminder', 'K-1008'], /paid its deposit/);
  ok((await call('draft-prearrival')).some((d) => d.ref === 'K-1006'), 'pre-arrival notes for the next two days');

  // Night audit.
  const audit = (await call('night-audit'))[0];
  ok(audit.in_house >= 3 && audit.not_arrived === 'none');
  eq((await one("select status from rooms where name = 'Unit 9'")).status, 'dirty', 'stayover rooms need a service tomorrow');

  // Records, settings and notes.
  await call('add', 'room-type', '--name=Garden studio', '--base-rate=189', '--max-guests=2');
  await call('add', 'room', '--name=Unit 11', '--room-type=Garden studio', '--sort=11');
  await reject(['add', 'room', '--name=Unit 12'], /--room-type/);
  await call('add', 'rate', '--name=Christmas', '--room-type=Garden studio', '--starts-on=2028-12-20', '--ends-on=2028-12-31', '--nightly=259', '--min-nights=3');
  await call('add', 'channel', '--name=Agoda', '--kind=ota', '--commission-pct=17');
  await call('set', 'channel', 'Booking.com', '--commission-pct=16');
  eq(Number((await one("select commission_pct from channels where name = 'Booking.com'")).commission_pct), 16);
  await call('set', 'settings', '--deposit-pct=25');
  eq((await one('select deposit_pct from settings')).deposit_pct, 25);
  await reject(['add', 'room', '--name=Bad', '--room-type=Studio', '--colour=red'], /Unknown room field --colour/);
  await reject(['add', 'room-type', '--name=Bad', '--base-rate=lots'], /amount/);
  await call('log', 'K-1003', 'Crew extending two nights, PO to follow');
  await call('log', 'Margaret Reid', 'Asked us to keep her details for her next visit');
  ok((await call('activity')).some((r) => r.kind === 'note'));

  // Import from Little Hotelier: the date order is asked, a dry run first, then apply, then nothing new.
  const csv = path.join(REPO_ROOT, 'fixtures', 'little-hotelier', 'reservations.csv');
  await reject(['import', 'little-hotelier', csv], /--date-order/);
  const dry = (await call('import', 'little-hotelier', csv, '--date-order=dmy'))[0];
  eq([dry.mode, dry.inserted], ['dry-run', 4]);
  eq((await one("select count(*)::int n from bookings where ref like 'LH-%'")).n, 0, 'dry run saves nothing');
  const lh = (await call('import', 'little-hotelier', csv, '--date-order=dmy', '--apply'))[0];
  eq([lh.inserted, lh.masked_guests, lh.room_types_created, lh.channels_created, lh.unassigned], [4, 1, 1, 2, 2]);
  eq(lh.guests_created, 3, 'Emma Clarke matched by email');
  eq((await call('import', 'little-hotelier', csv, '--date-order=dmy', '--apply'))[0].existing, 4, 'second run adds nothing');
  const anna = await one("select * from v_bookings where ref = 'LH-50001'");
  eq([anna.room, anna.arrive_on, anna.nights, Number(anna.accommodation_cents)], ['Unit 3', '2028-03-12', 3, 59700]);
  eq((await one("select status from bookings where ref = 'LH-50004'")).status, 'cancelled');
  eq((await one("select kind from channels where name = 'Airbnb'")).kind, 'ota');
  eq((await one("select kind from channels where name = 'Direct'")).kind, 'direct');
  eq(Number((await one("select paid_cents from v_bookings where ref = 'LH-50002'")).paid_cents), 10360);
  ok((await one("select g.name from bookings b join guests g on g.id = b.guest_id where b.ref = 'LH-50003'")).name.startsWith('Masked guest'));
  const bad = path.join(dir, 'bad.csv');
  fs.writeFileSync(bad, 'Booking Reference,Check In,Check Out,Guest Name,Total\nLH-1,2028-05-02,2028-05-01,A Guest,100\n');
  await reject(['import', 'little-hotelier', bad, '--apply'], /not after check-in/);
  fs.writeFileSync(bad, 'Guest Name,Check In\nA,2028-05-01\n');
  await reject(['import', 'little-hotelier', bad], /no reservation ID/);
  fs.writeFileSync(bad, 'name\n"unterminated\n');
  await reject(['import', 'little-hotelier', bad], /Malformed CSV/);
  await reject(['import', 'siteminder', bad], /Supported imports/);

  // Outside calendars: Airbnb's feed replaces its own future blocks; ours goes out with no guest names.
  const ics = path.join(REPO_ROOT, 'fixtures', 'ical', 'airbnb-unit-7.ics');
  eq((await call('import', 'ical', 'Unit 7', ics, '--source=airbnb'))[0].mode, 'dry-run');
  const cal = (await call('import', 'ical', 'Unit 7', ics, '--source=airbnb', '--apply'))[0];
  eq([cal.inserted, cal.removed], [2, 1], 'the old demo block is gone from the feed');
  eq((await call('import', 'ical', 'Unit 7', ics, '--source=airbnb', '--apply'))[0].unchanged, 2);
  ok(!(await call('conflicts')).some((c) => c.kind === 'calendar block'), 'the Airbnb clash cleared');
  await reject(['book', 'Sea Guest', 'One-bedroom', '2028-06-06', '2', '--room=Unit 7'], /not free/);
  fs.writeFileSync(bad, 'not a calendar');
  await reject(['import', 'ical', 'Unit 7', bad, '--source=airbnb'], /Not an iCal file/);
  const feeds = await call('ical-export', 'feeds', '--exclude-source=airbnb');
  eq(feeds.length, 11);
  const feed7 = fs.readFileSync(find(feeds, 'room', 'Unit 6').file, 'utf8');
  ok(feed7.includes('BEGIN:VCALENDAR') && feed7.includes('SUMMARY:Not available') && !feed7.includes('Daniel'), 'no guest names leave the building');
  ok(!fs.readFileSync(find(feeds, 'room', 'Unit 7').file, 'utf8').includes('airbnb.com'), 'Airbnb blocks are not sent back to Airbnb');

  // Export, then the rest of the reports on the changed data.
  const snapshot = path.join(dir, 'backup', 'hotel.json');
  ok((await call('export', snapshot))[0].records > 1000);
  await reject(['export', snapshot], /EEXIST|exist/);
  const weekly = await call('weekly-review');
  eq(Object.keys(weekly), ['attention', 'next twelve weeks', 'picked up this week', 'deposits', 'channels']);
  for (const name of Object.keys(reports)) ok(Array.isArray(await call(name)));
  ok((await call('activity')).some((r) => r.kind === 'check-out'), 'actions are audited');
  for (const cmd of ['help', 'availability', 'booking', 'guest', 'weekly-review', ...Object.keys(reports), ...actions]) ok(seen.has(cmd), `smoke exercised ${cmd}`);
  await db.close();
  db = null;

  // The CLI as a process: tables, --json, and exit 1 with candidates when a name is ambiguous.
  const json = cli('rooms', '--json');
  eq(json.status, 0, json.stderr);
  eq(JSON.parse(json.stdout).length, 11);
  const amb = cli('booking', 'Kiri');
  eq(amb.status, 1);
  ok(amb.stderr.includes('Candidates:'));
  ok(cli('attention').stdout.includes('reason'));

  // Documents and views in the property's brand.
  for (const script of ['docs', 'view']) {
    const res = spawnSync(process.execPath, [`scripts/${script}.mjs`], { cwd: REPO_ROOT, env: process.env, encoding: 'utf8' });
    eq(res.status, 0, res.stderr);
  }
  ok(fs.readFileSync(path.join(dir, 'views', 'today.html'), 'utf8').includes('Kowhai Lodge Motel (demo)'));
  ok(fs.readFileSync(path.join(dir, 'views', 'performance.html'), 'utf8').includes('RevPAR'));
  const inv = fs.readdirSync(path.join(dir, 'docs-out', 'tax-invoice')).find((f) => f.startsWith('inv-1002'));
  const invoice = fs.readFileSync(path.join(dir, 'docs-out', 'tax-invoice', inv), 'utf8');
  ok(invoice.includes('GST number 123-456-789') && invoice.includes('Emma Clarke') && invoice.includes('428.00'), 'the invoice carries the GST number, the guest and the total');
  ok(fs.readdirSync(path.join(dir, 'docs-out', 'registration-card')).length >= 1);
  ok(fs.readFileSync(path.join(dir, 'docs-out', 'fire-roll', fs.readdirSync(path.join(dir, 'docs-out', 'fire-roll'))[0]), 'utf8').includes('Ruth Adams'));
  ok(fs.readdirSync(path.join(dir, 'docs-out', 'housekeeping-sheet')).length === 1);

  const recipes = fs.readdirSync(path.join(REPO_ROOT, '.claude', 'commands')).filter((f) => f.endsWith('.md') && f !== 'README.md');
  console.log(`PASS: ${checks} checks; ${seen.size} CLI commands exercised; ${recipes.length} slash commands; documents and views rendered.`);
} finally {
  await db?.close();
  fs.rmSync(dir, { recursive: true, force: true });
}
