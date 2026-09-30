// The property's records in one place: which tables a command may write, how names resolve,
// and every read report as one query over the views in supabase/migrations.

// entity -> [table, label column, fields that add/set may write]
export const entities = {
  'room-type': ['room_types', 'name', ['name', 'code', 'base_rate', 'max_guests', 'description']],
  room: ['rooms', 'name', ['name', 'room_type', 'property', 'sort', 'active']],
  rate: ['rate_plans', 'name', ['name', 'room_type', 'starts_on', 'ends_on', 'nightly', 'min_nights']],
  channel: ['channels', 'name', ['name', 'kind', 'commission_pct']],
  guest: ['guests', 'name', ['name', 'email', 'phone', 'address', 'country', 'company', 'business_number', 'vip', 'do_not_rebook', 'marketing_ok', 'notes']],
  booking: ['bookings', 'ref', ['adults', 'children', 'channel', 'channel_ref', 'eta', 'requests', 'deposit', 'deposit_due_on', 'long_stay_agreed']],
  setting: ['settings', 'business_name', ['business_name', 'timezone', 'country', 'currency', 'gst_rate', 'gst_number', 'booking_prefix', 'invoice_prefix',
    'deposit_pct', 'deposit_days', 'long_stay_nights', 'au_long_stay_concession', 'quiet_days', 'privacy_review_years']],
};

// flag -> [column, entity it points at]
export const refs = { room_type: ['room_type_id', 'room-type'], channel: ['channel_id', 'channel'], room: ['room_id', 'room'] };
// flag -> column, amount entered in dollars and stored in cents
export const money = { base_rate: 'base_rate_cents', nightly: 'nightly_cents', deposit: 'deposit_cents' };

// Match an exact id or name first, then a partial id or a name fragment. Ambiguous lists the candidates.
export async function resolve(db, entity, value) {
  const def = entities[entity];
  if (!def) throw Error(`Unknown record type ${entity}. Use ${Object.keys(entities).join(', ')}`);
  if (entity === 'booking') return resolveBooking(db, value);
  const [table, label] = def;
  const s = String(value ?? '').trim();
  if (!s) throw Error(`Name or id of the ${entity} is required`);
  let rows = await db.query(`select * from ${table} where id::text = $1 or lower(${label}) = lower($1)`, [s]);
  if (!rows.length) rows = await db.query(`select * from ${table} where starts_with(id::text, lower($1)) or strpos(lower(${label}), lower($1)) > 0 order by ${label}, id`, [s]);
  if (rows.length === 1) return rows[0];
  if (!rows.length) throw Error(`No ${entity} matches "${s}"`);
  throw Error(`Ambiguous ${entity} "${s}". Candidates:\n${rows.map((r) => `  ${r.id.slice(0, 8)}  ${r[label]}`).join('\n')}`);
}

// A booking by its ref, part of its ref, or the guest's name. Among several, the one still open wins.
export async function resolveBooking(db, value) {
  const s = String(value ?? '').trim();
  if (!s) throw Error('Booking ref or guest name is required');
  let rows = await db.query('select b.*, g.name guest from bookings b join guests g on g.id = b.guest_id where lower(b.ref) = lower($1) or b.id::text = $1', [s]);
  if (!rows.length) {
    rows = await db.query(`select b.*, g.name guest from bookings b join guests g on g.id = b.guest_id
      where strpos(lower(b.ref), lower($1)) > 0 or strpos(lower(g.name), lower($1)) > 0 or starts_with(b.id::text, lower($1)) order by b.arrive_on desc`, [s]);
    const open = rows.filter((r) => ['enquiry', 'confirmed', 'checked_in'].includes(r.status));
    if (rows.length > 1 && open.length === 1) rows = open;
  }
  if (rows.length === 1) return rows[0];
  if (!rows.length) throw Error(`No booking matches "${s}"`);
  throw Error(`Ambiguous booking "${s}". Candidates:\n${rows.slice(0, 12).map((r) => `  ${r.ref}  ${r.guest}  ${r.arrive_on} to ${r.depart_on}  ${r.status}`).join('\n')}`);
}

const dollars = (c) => `round(${c} / 100.0, 2)`;
const LIVE = "('confirmed', 'checked_in', 'checked_out')";

export const reports = {
  rooms: `select r.name room, t.name room_type, r.property, r.status, r.out_of_order_reason, r.out_of_order_until, r.active
    from rooms r join room_types t on t.id = r.room_type_id order by r.sort, r.name`,
  'room-types': `select t.name, t.code, s.currency, ${dollars('t.base_rate_cents')} base_rate, t.max_guests,
    (select count(*) from rooms r where r.room_type_id = t.id and r.active) rooms, t.description from room_types t cross join settings s order by t.base_rate_cents`,
  rates: `select p.name, t.name room_type, p.starts_on, p.ends_on, s.currency, ${dollars('p.nightly_cents')} nightly, p.min_nights,
    ${dollars('t.base_rate_cents')} base_rate from rate_plans p join room_types t on t.id = p.room_type_id cross join settings s
    where p.ends_on >= hotel_today() - 30 order by p.starts_on, t.base_rate_cents`,
  channels: `select name, kind, commission_pct from channels order by kind, name`,
  guests: `select g.name, g.email, g.phone, g.country, g.company, g.vip, g.do_not_rebook,
    (select count(*) from bookings b where b.guest_id = g.id and b.status in ('checked_in', 'checked_out')) stays,
    (select max(b.depart_on) from bookings b where b.guest_id = g.id and b.status in ('checked_in', 'checked_out')) last_stay
    from guests g order by last_stay desc nulls last, g.name limit 60`,
  arrivals: `select case when v.arrive_on = hotel_today() then 'today' else 'tomorrow' end as day, v.ref, v.guest, v.room_type, coalesce(v.room, 'not assigned') room,
    v.nights, v.adults, v.children, b.eta, v.channel, v.currency, ${dollars('v.balance_cents')} balance, b.requests
    from v_bookings v join bookings b on b.id = v.id where v.status = 'confirmed' and v.arrive_on between hotel_today() and hotel_today() + 1
    order by v.arrive_on, v.room nulls first`,
  departures: `select v.ref, v.guest, v.room, v.nights, v.currency, ${dollars('v.total_cents')} total, ${dollars('v.paid_cents')} paid, ${dollars('v.balance_cents')} balance
    from v_bookings v where v.status = 'checked_in' and v.depart_on <= hotel_today() order by v.room`,
  'in-house': `select v.room, v.ref, v.guest, v.adults, v.children, v.arrive_on, v.depart_on, v.depart_on - hotel_today() nights_left, v.currency, ${dollars('v.balance_cents')} balance
    from v_bookings v where v.status = 'checked_in' order by v.room`,
  bookings: `select v.ref, v.status, v.guest, v.room_type, v.room, v.arrive_on, v.nights, v.channel, v.currency, ${dollars('v.total_cents')} total, ${dollars('v.balance_cents')} balance
    from v_bookings v where v.status in ('enquiry', 'confirmed', 'checked_in') and v.arrive_on <= hotel_today() + 60 order by v.arrive_on, v.ref`,
  housekeeping: `select room, room_type, status, housekeeping, in_house, departs, arriving, eta from v_room_status
    order by case when housekeeping like 'clean now%' then 0 when housekeeping like 'check-out%' then 1 when housekeeping = 'stayover service' then 2 else 3 end, sort`,
  attention: `select reason, ref, guest, detail from v_attention order by reason, ref`,
  compliance: `select rule, ref, guest, finding from v_compliance order by rule, ref`,
  occupancy: `select month, on_books, room_nights, nights_sold, occupancy_pct, s.currency, ${dollars('revenue_cents')} revenue, ${dollars('adr_cents')} adr, ${dollars('revpar_cents')} revpar
    from v_occupancy cross join settings s where nights_sold > 0 or on_books order by month`,
  'channel-mix': `select channel, kind, bookings, nights, s.currency, ${dollars('revenue_cents')} revenue, ${dollars('commission_cents')} commission, ${dollars('net_cents')} net,
    round(100.0 * net_cents / nullif(sum(net_cents) over (), 0), 1) share_of_net_pct, avg_lead_days, cancelled, no_shows
    from v_channel_mix cross join settings s order by net_cents desc`,
  balances: `select v.ref, v.status, v.guest, v.depart_on, v.currency, ${dollars('v.total_cents')} total, ${dollars('v.paid_cents')} paid, ${dollars('v.balance_cents')} balance
    from v_bookings v where v.status <> 'enquiry' and v.balance_cents <> 0 and (v.status <> 'confirmed' or v.balance_cents < 0)
    order by v.status = 'checked_in', v.depart_on`,
  deposits: `select v.ref, v.guest, v.arrive_on, v.deposit_due_on, v.currency, ${dollars('v.deposit_cents')} deposit, ${dollars('greatest(v.paid_cents, 0)')} paid,
    case when v.paid_cents >= v.deposit_cents then 'paid' when v.deposit_due_on < hotel_today() then 'overdue' else 'due' end state
    from v_bookings v where v.status = 'confirmed' and v.deposit_cents > 0 order by v.paid_cents >= v.deposit_cents, v.deposit_due_on`,
  conflicts: `select room, ref, clashes_with, kind, from_on, to_on from v_conflicts order by from_on`,
  pickup: `select to_char(v.arrive_on, 'YYYY-MM') arrival_month, count(*) filter (where v.status in ${LIVE}) new_bookings,
    sum(v.nights) filter (where v.status in ${LIVE}) nights, v.currency, ${dollars(`sum(v.accommodation_cents)`)} revenue,
    count(*) filter (where v.status = 'cancelled' and b.cancelled_on > hotel_today() - 7) cancelled_this_week
    from v_bookings v join bookings b on b.id = v.id where (v.booked_on > hotel_today() - 7 or b.cancelled_on > hotel_today() - 7) and v.status <> 'enquiry'
    group by 1, v.currency order by 1`,
  forecast: `select w::date week_of, (select count(*) from rooms where active) * 7 room_nights,
    count(n.id) nights_on_books, round(100.0 * count(n.id) / nullif((select count(*) from rooms where active) * 7, 0), 1) occupancy_pct,
    s.currency, ${dollars('coalesce(sum(n.rate_cents), 0)')} revenue_on_books
    from generate_series(date_trunc('week', hotel_today()), date_trunc('week', hotel_today()) + interval '11 weeks', interval '1 week') w
    cross join settings s
    left join (select n.* from booking_nights n join v_live b on b.id = n.booking_id) n on n.night_on >= w::date and n.night_on < w::date + 7
    group by w, s.currency order by w`,
  'repeat-guests': `select g.name guest, count(*) stays, sum(v.nights) nights, v.currency, ${dollars('sum(v.total_cents)')} spent, max(v.depart_on) last_stay,
    count(*) filter (where v.channel_kind in ('direct', 'walk-in', 'corporate')) direct_stays, string_agg(distinct v.channel, ', ') channels, g.email
    from v_bookings v join guests g on g.id = v.guest_id where v.status in ('checked_in', 'checked_out')
    group by g.id, g.name, g.email, v.currency having count(*) > 1 order by stays desc, spent desc`,
  cancellations: `select v.ref, v.guest, v.status, v.channel, v.arrive_on, b.cancelled_on, b.cancel_reason, v.currency, ${dollars('v.extras_cents')} fee_charged, ${dollars('v.balance_cents')} balance
    from v_bookings v join bookings b on b.id = v.id where v.status in ('cancelled', 'no_show') and v.arrive_on > hotel_today() - 90 order by v.arrive_on desc`,
  invoices: `select i.number, i.issued_on, v.ref, v.guest, v.currency, ${dollars('i.total_cents')} total, ${dollars('i.gst_cents')} gst
    from invoices i join v_bookings v on v.id = i.booking_id order by i.issued_on desc, i.number desc limit 30`,
  blocks: `select r.name room, k.starts_on, k.ends_on, k.source, k.summary from blocks k join rooms r on r.id = k.room_id where k.ends_on >= hotel_today() order by k.starts_on, r.name`,
  activity: `select * from (select coalesce(b.ref, g.name, r.name) about, 'note' kind, n.note detail, n.created_at at_time from notes n
      left join bookings b on b.id = n.booking_id left join guests g on g.id = n.guest_id left join rooms r on r.id = n.room_id
    union all select '', a.action, left(a.detail::text, 90), a.created_at from audit a) x order by at_time desc limit 30`,
};
