-- Small Hotel for Claude Code: rooms, rates, channels, guests, bookings by the night,
-- folios (charges and payments), tax invoices, outside calendar blocks, housekeeping,
-- and the views the front desk runs on every day.
-- Plain Postgres. Runs the same on hosted Postgres and embedded PGlite.

create table settings (
  id integer primary key default 1 check (id = 1),
  business_name text not null default 'Your property',
  timezone text not null default 'Pacific/Auckland',
  country text not null default 'NZ' check (country in ('NZ', 'AU')),
  currency text not null default 'NZD' check (currency in ('NZD', 'AUD')),
  gst_rate numeric(5, 4) not null default 0.15 check (gst_rate >= 0 and gst_rate < 1),
  gst_number text not null default '',
  booking_prefix text not null default 'B-',
  invoice_prefix text not null default 'INV-',
  deposit_pct integer not null default 20 check (deposit_pct between 0 and 100),
  deposit_days integer not null default 7 check (deposit_days >= 0),
  long_stay_nights integer not null default 28 check (long_stay_nights > 0),
  au_long_stay_concession boolean not null default false,
  quiet_days integer not null default 3 check (quiet_days > 0),
  privacy_review_years integer not null default 7 check (privacy_review_years > 0)
);
insert into settings (id) values (1);

-- The property's own calendar day, not the server's.
create function hotel_today() returns date language sql stable as $$
  select (now() at time zone coalesce((select timezone from settings where id = 1), 'Pacific/Auckland'))::date
$$;

create table room_types (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (trim(name) <> ''),
  code text not null default '',
  base_rate_cents bigint not null default 0 check (base_rate_cents >= 0),
  max_guests integer not null default 2 check (max_guests > 0),
  description text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table rooms (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (trim(name) <> ''),
  room_type_id uuid not null references room_types(id),
  property text not null default '',
  status text not null default 'clean' check (status in ('clean', 'dirty', 'inspected', 'out_of_order')),
  out_of_order_reason text not null default '',
  out_of_order_until date,
  active boolean not null default true,
  sort integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- A seasonal or event rate for a room type. The shortest plan covering a night wins; no plan means the base rate.
create table rate_plans (
  id uuid primary key default gen_random_uuid(),
  name text not null check (trim(name) <> ''),
  room_type_id uuid not null references room_types(id),
  starts_on date not null,
  ends_on date not null,
  nightly_cents bigint not null check (nightly_cents >= 0),
  min_nights integer not null default 1 check (min_nights > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_on >= starts_on)
);

create table channels (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (trim(name) <> ''),
  kind text not null default 'direct' check (kind in ('direct', 'ota', 'agent', 'walk-in', 'corporate')),
  commission_pct numeric(5, 2) not null default 0 check (commission_pct >= 0 and commission_pct < 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table guests (
  id uuid primary key default gen_random_uuid(),
  name text not null check (trim(name) <> ''),
  email text not null default '',
  phone text not null default '',
  address text not null default '',
  country text not null default '',
  company text not null default '',
  business_number text not null default '',
  vip boolean not null default false,
  do_not_rebook boolean not null default false,
  marketing_ok boolean not null default false,
  notes text not null default '',
  external_id text unique,
  source_data jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index guests_email on guests (lower(email)) where email <> '';

create table bookings (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique check (trim(ref) <> ''),
  guest_id uuid not null references guests(id),
  room_type_id uuid not null references room_types(id),
  room_id uuid references rooms(id),
  channel_id uuid references channels(id),
  arrive_on date not null,
  depart_on date not null,
  adults integer not null default 2 check (adults >= 0),
  children integer not null default 0 check (children >= 0),
  status text not null default 'confirmed' check (status in ('enquiry', 'confirmed', 'checked_in', 'checked_out', 'cancelled', 'no_show')),
  long_stay_agreed boolean not null default false,
  deposit_cents bigint not null default 0 check (deposit_cents >= 0),
  deposit_due_on date,
  channel_ref text not null default '',
  eta text not null default '',
  requests text not null default '',
  booked_on date not null default hotel_today(),
  checked_in_at timestamptz,
  checked_out_at timestamptz,
  cancelled_on date,
  cancel_reason text not null default '',
  external_id text unique,
  source_data jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (depart_on > arrive_on)
);
create index bookings_dates on bookings (arrive_on, depart_on);

-- One row per night sold, at the rate that night carries. Occupancy, ADR and RevPAR all read from here.
create table booking_nights (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings(id) on delete cascade,
  night_on date not null,
  rate_cents bigint not null check (rate_cents >= 0),
  rate_plan text not null default '',
  created_at timestamptz not null default now(),
  unique (booking_id, night_on)
);
create index booking_nights_night on booking_nights (night_on);

create table charges (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings(id),
  posted_on date not null default hotel_today(),
  kind text not null default 'extra' check (kind in ('extra', 'breakfast', 'minibar', 'laundry', 'fee', 'cancellation', 'discount', 'other')),
  description text not null check (trim(description) <> ''),
  amount_cents bigint not null,
  gst_applies boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings(id),
  paid_on date not null default hotel_today(),
  kind text not null default 'payment' check (kind in ('deposit', 'payment', 'refund')),
  method text not null default 'card' check (method in ('card', 'eftpos', 'cash', 'bank', 'channel', 'voucher', 'other')),
  amount_cents bigint not null check (amount_cents <> 0),
  reference text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((kind = 'refund') = (amount_cents < 0))
);

create table invoices (
  id uuid primary key default gen_random_uuid(),
  number text not null unique,
  booking_id uuid not null unique references bookings(id),
  issued_on date not null default hotel_today(),
  total_cents bigint not null,
  gst_cents bigint not null,
  created_at timestamptz not null default now()
);

-- Nights a room is taken somewhere else: an Airbnb or Booking.com calendar (iCal), an owner stay, a hold.
create table blocks (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms(id),
  starts_on date not null,
  ends_on date not null,
  source text not null default 'manual',
  uid text not null default '',
  summary text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_on > starts_on)
);
create unique index blocks_feed_uid on blocks (room_id, source, uid) where uid <> '';

create table housekeeping (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms(id),
  done_on date not null default hotel_today(),
  kind text not null default 'clean' check (kind in ('clean', 'inspect', 'dirty', 'out_of_order', 'back_in_service')),
  done_by text not null default '',
  note text not null default '',
  created_at timestamptz not null default now()
);

create table notes (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid references bookings(id),
  guest_id uuid references guests(id),
  room_id uuid references rooms(id),
  note text not null check (trim(note) <> ''),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (num_nonnulls(booking_id, guest_id, room_id) >= 1)
);

create table audit (
  id uuid primary key default gen_random_uuid(),
  action text not null,
  record_id uuid,
  detail jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table import_rows (
  entity text not null,
  source_id text not null,
  record_id uuid not null,
  raw jsonb not null,
  created_at timestamptz not null default now(),
  primary key (entity, source_id)
);

create function stamp() returns trigger language plpgsql as $$
begin if new.updated_at is not distinct from old.updated_at then new.updated_at = clock_timestamp(); end if; return new; end $$;

do $$ declare t text; begin
  foreach t in array array['room_types', 'rooms', 'rate_plans', 'channels', 'guests', 'bookings', 'charges', 'payments', 'blocks', 'notes'] loop
    execute format('create trigger stamp before update on %I for each row execute function stamp()', t);
  end loop;
end $$;

-- ------------------------------------------------------------------ views

-- Bookings that hold a room: an enquiry does not, a cancellation or no-show no longer does.
create view v_live as
  select * from bookings where status in ('confirmed', 'checked_in', 'checked_out');

-- Every booking with its folio: accommodation, extras, payments, balance, and what the channel takes.
create view v_bookings as
  select b.id, b.ref, b.status, g.name guest, g.id guest_id, rt.name room_type, r.name room, c.name channel, c.kind channel_kind,
    b.arrive_on, b.depart_on, b.depart_on - b.arrive_on nights, b.adults, b.children, b.booked_on, b.arrive_on - b.booked_on lead_days,
    s.currency,
    case when b.status in ('confirmed', 'checked_in', 'checked_out') then coalesce(n.cents, 0) else 0 end accommodation_cents,
    coalesce(x.cents, 0) extras_cents,
    case when b.status in ('confirmed', 'checked_in', 'checked_out') then coalesce(n.cents, 0) else 0 end + coalesce(x.cents, 0) total_cents,
    coalesce(p.cents, 0) paid_cents,
    case when b.status in ('confirmed', 'checked_in', 'checked_out') then coalesce(n.cents, 0) else 0 end + coalesce(x.cents, 0) - coalesce(p.cents, 0) balance_cents,
    case when b.status in ('confirmed', 'checked_in', 'checked_out') then round(coalesce(n.cents, 0) * coalesce(c.commission_pct, 0) / 100.0)::bigint else 0 end commission_cents,
    b.deposit_cents, b.deposit_due_on, b.long_stay_agreed, b.room_id, b.room_type_id, b.channel_id, b.updated_at
  from bookings b
  join guests g on g.id = b.guest_id
  join room_types rt on rt.id = b.room_type_id
  left join rooms r on r.id = b.room_id
  left join channels c on c.id = b.channel_id
  cross join settings s
  left join (select booking_id, sum(rate_cents) cents from booking_nights group by booking_id) n on n.booking_id = b.id
  left join (select booking_id, sum(amount_cents) cents from charges group by booking_id) x on x.booking_id = b.id
  left join (select booking_id, sum(amount_cents) cents from payments group by booking_id) p on p.booking_id = b.id;

-- GST inside each night's price. NZ: from the 29th night (or the first, when a long stay was agreed up front) the
-- value is 60% for a stay over four weeks, unless booked through an online marketplace. AU: when the operator
-- elects the long-term concession, from the 28th day GST is worked out on 50% of the GST-inclusive price.
-- docs/compliance.md has the sources.
create view v_night_gst as
  select n.booking_id, n.night_on, n.rate_cents,
    row_number() over (partition by n.booking_id order by n.night_on) night_no,
    b.depart_on - b.arrive_on nights,
    case
      when s.country = 'NZ' and b.depart_on - b.arrive_on > s.long_stay_nights and coalesce(c.kind, 'direct') <> 'ota' then 'reduced'
      when s.country = 'AU' and s.au_long_stay_concession and b.depart_on - b.arrive_on >= s.long_stay_nights then 'concession'
      else 'standard' end regime,
    s.gst_rate, s.country, s.long_stay_nights, b.long_stay_agreed
  from booking_nights n join bookings b on b.id = n.booking_id left join channels c on c.id = b.channel_id cross join settings s;

create view v_booking_gst as
  select booking_id,
    sum(round(case
      when regime = 'reduced' and (long_stay_agreed or night_no > long_stay_nights) then rate_cents * (0.6 * gst_rate) / (1 + 0.6 * gst_rate)
      when regime = 'concession' and night_no >= long_stay_nights then rate_cents * (0.5 * gst_rate * (1 + gst_rate)) / (1 + 0.5 * gst_rate * (1 + gst_rate))
      else rate_cents * gst_rate / (1 + gst_rate) end))::bigint gst_cents,
    count(*) filter (where (regime = 'reduced' and (long_stay_agreed or night_no > long_stay_nights)) or (regime = 'concession' and night_no >= long_stay_nights)) reduced_nights
  from v_night_gst group by booking_id;

create view v_folio as
  select b.*, coalesce(g.gst_cents, 0) * (case when b.status in ('confirmed', 'checked_in', 'checked_out') then 1 else 0 end)
      + coalesce((select round(sum(x.amount_cents * s.gst_rate / (1 + s.gst_rate))) from charges x cross join settings s where x.booking_id = b.id and x.gst_applies), 0)::bigint gst_cents,
    coalesce(g.reduced_nights, 0) reduced_nights
  from v_bookings b left join v_booking_gst g on g.booking_id = b.id;

-- Rooms and nights: who is in each room tonight, who arrives today, and what housekeeping has to do.
create view v_room_status as
  select r.id room_id, r.name room, rt.name room_type, r.property, r.status, r.out_of_order_reason, r.out_of_order_until, r.sort,
    ih.ref in_house_ref, ih.guest in_house, ih.depart_on departs,
    ar.ref arriving_ref, ar.guest arriving, ar.eta,
    case
      when r.status = 'out_of_order' then 'out of order'
      when ih.depart_on = hotel_today() and ar.ref is not null then 'check-out, then clean for arrival'
      when ih.depart_on = hotel_today() then 'check-out clean'
      when ih.ref is not null then 'stayover service'
      when ar.ref is not null and r.status = 'dirty' then 'clean now: guest arriving'
      when ar.ref is not null then 'ready for arrival'
      when r.status = 'dirty' then 'clean when you can'
      else 'vacant' end housekeeping
  from rooms r
  join room_types rt on rt.id = r.room_type_id
  left join lateral (select v.ref, v.guest, v.depart_on from v_bookings v where v.room_id = r.id and v.status = 'checked_in' order by v.arrive_on limit 1) ih on true
  left join lateral (select v.ref, v.guest, b.eta from v_bookings v join bookings b on b.id = v.id where v.room_id = r.id and v.status = 'confirmed' and v.arrive_on = hotel_today() limit 1) ar on true
  where r.active;

-- Two things in one room on one night: two bookings, or a booking and an outside calendar block.
create view v_conflicts as
  select r.name room, a.ref, b.ref clashes_with, 'booking' kind, greatest(a.arrive_on, b.arrive_on) from_on, least(a.depart_on, b.depart_on) to_on
  from v_live a join v_live b on a.room_id = b.room_id and a.id < b.id and a.arrive_on < b.depart_on and b.arrive_on < a.depart_on
  join rooms r on r.id = a.room_id
  where a.status <> 'checked_out' or b.status <> 'checked_out'
  union all
  select r.name, a.ref, coalesce(nullif(k.summary, ''), k.source) || ' (' || k.source || ')', 'calendar block', greatest(a.arrive_on, k.starts_on), least(a.depart_on, k.ends_on)
  from v_live a join blocks k on k.room_id = a.room_id and a.arrive_on < k.ends_on and k.starts_on < a.depart_on
  join rooms r on r.id = a.room_id
  where a.status <> 'checked_out';

-- Room nights by month: what was available (every active room, every night), what sold, and what it earned.
create view v_occupancy as
  with months as (
    select generate_series(date_trunc('month', hotel_today()) - interval '11 months', date_trunc('month', hotel_today()) + interval '2 months', interval '1 month')::date m
  ), avail as (
    select m.m, count(*) room_nights
    from months m cross join (select id from rooms where active) r cross join lateral generate_series(m.m, (m.m + interval '1 month' - interval '1 day')::date, interval '1 day') d(night)
    group by m.m
  ), sold as (
    select date_trunc('month', n.night_on)::date m, count(*) nights, sum(n.rate_cents) cents
    from booking_nights n join v_live b on b.id = n.booking_id group by 1
  )
  select to_char(a.m, 'YYYY-MM') as month, a.m >= date_trunc('month', hotel_today())::date on_books, a.room_nights,
    coalesce(s.nights, 0) nights_sold,
    round(100.0 * coalesce(s.nights, 0) / nullif(a.room_nights, 0), 1) occupancy_pct,
    coalesce(s.cents, 0) revenue_cents,
    round(coalesce(s.cents, 0) / nullif(s.nights, 0))::bigint adr_cents,
    round(coalesce(s.cents, 0)::numeric / nullif(a.room_nights, 0))::bigint revpar_cents
  from avail a left join sold s on s.m = a.m order by a.m;

-- Which channel earns what, once its commission is taken off. Twelve months of arrivals.
create view v_channel_mix as
  select coalesce(b.channel, 'No channel') channel, coalesce(b.channel_kind, '') kind,
    count(*) filter (where b.status in ('confirmed', 'checked_in', 'checked_out')) bookings,
    sum(b.nights) filter (where b.status in ('confirmed', 'checked_in', 'checked_out')) nights,
    sum(b.accommodation_cents) revenue_cents, sum(b.commission_cents) commission_cents,
    sum(b.accommodation_cents) - sum(b.commission_cents) net_cents,
    round(avg(b.lead_days) filter (where b.status in ('confirmed', 'checked_in', 'checked_out')), 1) avg_lead_days,
    count(*) filter (where b.status = 'cancelled') cancelled, count(*) filter (where b.status = 'no_show') no_shows
  from v_bookings b
  where b.arrive_on > hotel_today() - 365 and b.status <> 'enquiry'
  group by 1, 2;

create view v_attention as
  select v.ref, v.guest, 'arriving with no room' reason, 'arrives ' || v.arrive_on || ', ' || v.room_type detail
  from v_bookings v where v.status = 'confirmed' and v.room_id is null and v.arrive_on <= hotel_today() + 1
  union all
  select c.ref, c.room, 'double booked', c.clashes_with || ', ' || c.from_on || ' to ' || c.to_on from v_conflicts c
  union all
  select v.ref, v.guest, 'no-show?', 'due ' || v.arrive_on || ', not checked in' from v_bookings v where v.status = 'confirmed' and v.arrive_on < hotel_today()
  union all
  select v.ref, v.guest, 'overstay', 'was due out ' || v.depart_on from v_bookings v where v.status = 'checked_in' and v.depart_on < hotel_today()
  union all
  select v.ref, v.guest, 'balance owing at departure', v.currency || ' ' || round(v.balance_cents / 100.0, 2) || ' owing, departs ' || v.depart_on
  from v_bookings v where v.status = 'checked_in' and v.depart_on <= hotel_today() and v.balance_cents > 0
  union all
  select v.ref, v.guest, 'departed owing', v.currency || ' ' || round(v.balance_cents / 100.0, 2) || ' owing since ' || v.depart_on
  from v_bookings v where v.status in ('checked_out', 'cancelled', 'no_show') and v.balance_cents > 0
  union all
  select v.ref, v.guest, 'deposit overdue', v.currency || ' ' || round((v.deposit_cents - greatest(v.paid_cents, 0)) / 100.0, 2) || ' was due ' || v.deposit_due_on
  from v_bookings v where v.status = 'confirmed' and v.deposit_due_on < hotel_today() and v.paid_cents < v.deposit_cents
  union all
  select v.ref, v.guest, 'no tax invoice', 'checked out ' || v.depart_on from v_bookings v
  where v.status = 'checked_out' and not exists (select 1 from invoices i where i.booking_id = v.id)
  union all
  select v.ref, v.guest, 'enquiry gone quiet', 'no reply for ' || (hotel_today() - v.updated_at::date) || ' days'
  from v_bookings v cross join settings s where v.status = 'enquiry' and v.updated_at::date <= hotel_today() - s.quiet_days
  union all
  select r.arriving_ref, r.room, 'room not ready', r.arriving || ' arriving today, room is ' || r.status
  from v_room_status r where r.arriving_ref is not null and r.status in ('dirty', 'out_of_order')
  union all
  select r.name, '', 'out of order past its date', r.out_of_order_reason || ', was due back ' || r.out_of_order_until
  from rooms r where r.active and r.status = 'out_of_order' and r.out_of_order_until < hotel_today();

-- Record checks. Each rule and its source is in docs/compliance.md.
create view v_compliance as
  select 'NZ-LONG-STAY-GST' rule, v.ref, v.guest, v.nights || ' nights through ' || coalesce(v.channel, 'no channel') || ': ' ||
    case when v.channel_kind = 'ota' then 'booked through an online marketplace, so the reduced value does not apply. Check with your accountant'
         when v.long_stay_agreed then 'agreed up front as a long stay: GST on 60% of the value from the first night'
         else 'GST on 60% of the value from night ' || (s.long_stay_nights + 1) || '. If it was agreed up front, record it and the reduced value runs from night 1' end finding
  from v_bookings v cross join settings s
  where s.country = 'NZ' and v.status in ('confirmed', 'checked_in', 'checked_out') and v.nights > s.long_stay_nights and v.depart_on > hotel_today() - 90
  union all
  select 'AU-LONG-STAY-GST', v.ref, v.guest, v.nights || ' nights: ' ||
    case when s.au_long_stay_concession then 'concession applied from day ' || s.long_stay_nights else 'full GST charged. The long-term concession is off in settings; decide with your accountant' end
  from v_bookings v cross join settings s
  where s.country = 'AU' and v.status in ('confirmed', 'checked_in', 'checked_out') and v.nights >= s.long_stay_nights and v.depart_on > hotel_today() - 90
  union all
  select 'GST-NUMBER', '', '', 'Invoices are being issued with no ' || case when s.country = 'NZ' then 'GST number' else 'ABN' end || ' in settings'
  from settings s where s.gst_number = '' and exists (select 1 from invoices)
  union all
  select case when s.country = 'NZ' then 'NZ-INVOICE-OVER-1000' else 'AU-INVOICE-1000-PLUS' end, v.ref, v.guest,
    i.number || ' for ' || s.currency || ' ' || round(i.total_cents / 100.0, 2) || ' has ' ||
    case when s.country = 'NZ' then 'the guest name but no address, phone, email or business number on the guest record'
         else 'no buyer identity or ABN on the guest record' end
  from invoices i join v_bookings v on v.id = i.booking_id join guests g on g.id = v.guest_id cross join settings s
  where ((s.country = 'NZ' and i.total_cents > 100000 and g.address = '' and g.phone = '' and g.email = '' and g.business_number = '')
      or (s.country = 'AU' and i.total_cents >= 100000 and g.business_number = '' and g.company = '' and (g.name ilike '%guest%' or g.address = '')))
  union all
  select 'PRIVACY-RETENTION', '', g.name, 'Last stay ended ' || coalesce(max(b.depart_on)::text, 'never') || ', over ' || s.privacy_review_years || ' years ago: review whether to keep, anonymise or delete'
  from guests g left join bookings b on b.guest_id = g.id cross join settings s
  group by g.id, g.name, s.privacy_review_years
  having coalesce(max(b.depart_on), min(g.created_at)::date) < hotel_today() - (s.privacy_review_years * 365)
  union all
  select 'CARD-DATA', '', g.name, 'A card number may be written in the guest notes: remove it'
  from guests g where g.notes ~ '[0-9]{4}[ -]?[0-9]{4}[ -]?[0-9]{4}[ -]?[0-9]{1,4}'
  union all
  select 'DOUBLE-BOOKING', c.ref, c.room, 'Also ' || c.clashes_with || ' (' || c.kind || '), ' || c.from_on || ' to ' || c.to_on from v_conflicts c;
