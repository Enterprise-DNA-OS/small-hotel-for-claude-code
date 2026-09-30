-- Demo property: Kowhai Lodge Motel, a fictional ten-unit motel in Wanaka. Dates are relative to
-- today, so there is always someone arriving, someone owing, a room not ready and a double booking.
-- About six months of past stays give the occupancy and channel reports something to say. Safe to run twice.

update settings set business_name = 'Kowhai Lodge Motel (demo)', gst_number = '123-456-789', booking_prefix = 'K-' where id = 1 and business_name = 'Your property';

insert into room_types (id, name, code, base_rate_cents, max_guests, description) values
 ('11111111-0000-4000-8000-000000000001', 'Studio', 'STU', 16900, 2, 'Queen bed, kitchenette, lake glimpse'),
 ('11111111-0000-4000-8000-000000000002', 'One-bedroom unit', '1BR', 21900, 3, 'Queen bedroom, lounge with sofa bed, full kitchen'),
 ('11111111-0000-4000-8000-000000000003', 'Two-bedroom family unit', '2BR', 32900, 5, 'Queen and two singles, full kitchen, laundry')
on conflict do nothing;

insert into rooms (id, name, room_type_id, status, sort, out_of_order_reason, out_of_order_until) values
 ('22222222-0000-4000-8000-000000000001', 'Unit 1', '11111111-0000-4000-8000-000000000001', 'clean', 1, '', null),
 ('22222222-0000-4000-8000-000000000002', 'Unit 2', '11111111-0000-4000-8000-000000000001', 'dirty', 2, '', null),
 ('22222222-0000-4000-8000-000000000003', 'Unit 3', '11111111-0000-4000-8000-000000000001', 'clean', 3, '', null),
 ('22222222-0000-4000-8000-000000000004', 'Unit 4', '11111111-0000-4000-8000-000000000001', 'dirty', 4, '', null),
 ('22222222-0000-4000-8000-000000000005', 'Unit 5', '11111111-0000-4000-8000-000000000002', 'clean', 5, '', null),
 ('22222222-0000-4000-8000-000000000006', 'Unit 6', '11111111-0000-4000-8000-000000000002', 'inspected', 6, '', null),
 ('22222222-0000-4000-8000-000000000007', 'Unit 7', '11111111-0000-4000-8000-000000000002', 'clean', 7, '', null),
 ('22222222-0000-4000-8000-000000000008', 'Unit 8', '11111111-0000-4000-8000-000000000002', 'out_of_order', 8, 'Heat pump fault, electrician booked', hotel_today() - 1),
 ('22222222-0000-4000-8000-000000000009', 'Unit 9', '11111111-0000-4000-8000-000000000003', 'clean', 9, '', null),
 ('22222222-0000-4000-8000-000000000010', 'Unit 10', '11111111-0000-4000-8000-000000000003', 'clean', 10, '', null)
on conflict do nothing;

insert into rate_plans (id, name, room_type_id, starts_on, ends_on, nightly_cents, min_nights) values
 ('66666666-0000-4000-8000-000000000001', 'Ski season', '11111111-0000-4000-8000-000000000001', hotel_today() - 40, hotel_today() + 12, 19900, 1),
 ('66666666-0000-4000-8000-000000000002', 'Ski season', '11111111-0000-4000-8000-000000000002', hotel_today() - 40, hotel_today() + 12, 25900, 1),
 ('66666666-0000-4000-8000-000000000003', 'Ski season', '11111111-0000-4000-8000-000000000003', hotel_today() - 40, hotel_today() + 12, 38900, 2),
 ('66666666-0000-4000-8000-000000000004', 'Spring', '11111111-0000-4000-8000-000000000001', hotel_today() + 13, hotel_today() + 80, 17900, 1),
 ('66666666-0000-4000-8000-000000000005', 'Spring', '11111111-0000-4000-8000-000000000002', hotel_today() + 13, hotel_today() + 80, 22900, 1),
 ('66666666-0000-4000-8000-000000000006', 'Spring', '11111111-0000-4000-8000-000000000003', hotel_today() + 13, hotel_today() + 80, 34900, 2)
on conflict do nothing;

insert into channels (id, name, kind, commission_pct) values
 ('33333333-0000-4000-8000-000000000001', 'Direct website', 'direct', 0),
 ('33333333-0000-4000-8000-000000000002', 'Booking.com', 'ota', 15),
 ('33333333-0000-4000-8000-000000000003', 'Expedia', 'ota', 18),
 ('33333333-0000-4000-8000-000000000004', 'Walk-in', 'walk-in', 0),
 ('33333333-0000-4000-8000-000000000005', 'Phone', 'direct', 0),
 ('33333333-0000-4000-8000-000000000006', 'Central Contracting account', 'corporate', 0)
on conflict do nothing;

insert into guests (id, name, email, phone, address, country, company, business_number, vip, notes, created_at) values
 ('44444444-0000-4000-8000-000000000001', 'Emma Clarke', 'emma.clarke@example.com', '021 555 0301', '14 Rata Street, Christchurch', 'NZ', '', '', false, 'Prefers a ground floor unit', now() - interval '400 days'),
 ('44444444-0000-4000-8000-000000000002', 'Hamish Grant', 'hamish.g@example.com', '027 555 0302', '', 'NZ', '', '', false, 'Card on file 4111 1111 1111 1111 exp 09/28', now() - interval '30 days'),
 ('44444444-0000-4000-8000-000000000003', 'Ruth Adams', 'accounts@centralcontracting.example', '03 555 0303', '8 Ballantyne Road, Wanaka', 'NZ', 'Central Contracting', '9429041234567', false, 'Crew accommodation for the Albert Town bridge job', now() - interval '60 days'),
 ('44444444-0000-4000-8000-000000000004', 'Sophie Martin', 'sophie.m@example.com', '', '', 'AU', '', '', false, '', now() - interval '20 days'),
 ('44444444-0000-4000-8000-000000000005', 'Daniel Wu', 'daniel.wu@example.com', '022 555 0305', '', 'NZ', '', '', false, '', now() - interval '12 days'),
 ('44444444-0000-4000-8000-000000000006', 'Aroha Ngata', 'aroha.ngata@example.com', '021 555 0306', '22 Kahikatea Drive, Dunedin', 'NZ', '', '', true, 'Returning guest, likes Unit 3', now() - interval '700 days'),
 ('44444444-0000-4000-8000-000000000007', 'Mark Jensen', 'mark.jensen@example.com', '', '', 'DK', '', '', false, '', now() - interval '40 days'),
 ('44444444-0000-4000-8000-000000000008', 'Olivia Brown', 'olivia.b@example.com', '021 555 0308', '', 'NZ', '', '', false, 'Family of five, needs a cot', now() - interval '10 days'),
 ('44444444-0000-4000-8000-000000000009', 'Peter Hall', 'peter.hall@example.com', '', '', 'NZ', '', '', false, '', now() - interval '8 days'),
 ('44444444-0000-4000-8000-000000000010', 'Grace Lee', '', '', '', 'NZ', '', '', false, 'Walk-in, paid by card', now() - interval '14 days'),
 ('44444444-0000-4000-8000-000000000011', 'James Taylor', 'james.t@example.com', '', '', 'AU', '', '', false, '', now() - interval '6 days'),
 ('44444444-0000-4000-8000-000000000012', 'Chloe Evans', 'chloe.evans@example.com', '', '', 'GB', '', '', false, '', now() - interval '9 days'),
 ('44444444-0000-4000-8000-000000000013', 'Ben Walker', 'ben.walker@example.com', '021 555 0313', '', 'NZ', '', '', false, '', now() - interval '3 days'),
 ('44444444-0000-4000-8000-000000000014', 'Anna Smith', 'anna.smith@example.com', '', '', 'US', '', '', false, '', now() - interval '15 days'),
 ('44444444-0000-4000-8000-000000000015', 'Margaret Reid', 'm.reid@example.com', '03 555 0315', '3 Hill Street, Oamaru', 'NZ', '', '', false, '', '2017-02-01')
on conflict do nothing;

-- Past and future guests for the generated stays below: mostly one-off travellers, a few regulars.
insert into guests (id, name, email, country, created_at)
select ('44444444-0000-4000-8000-0000000' || lpad(i::text, 5, '0'))::uuid,
  (array['Tom', 'Mia', 'Sam', 'Isla', 'Noah', 'Lucy', 'Jack', 'Ella', 'Leo', 'Zoe', 'Oliver', 'Ruby', 'Hugo', 'Aria', 'Finn', 'Maia', 'Nikau', 'Ivy', 'Kai', 'Freya'])[1 + i % 20] || ' ' ||
  (array['Fletcher', 'Robinson', 'Patel', 'Morgan', 'Kim', 'Harris', 'Wilson', 'Thompson', 'Martin', 'Campbell', 'Scott', 'Young', 'Tane', 'Nguyen', 'Muller', 'Brown', 'Singh'])[1 + (i * 7 + i / 20) % 17],
  'guest' || i || '@example.com', (array['NZ', 'NZ', 'NZ', 'AU', 'AU', 'GB', 'US', 'DE', 'KR', 'NZ'])[1 + i % 10], now() - interval '200 days'
from generate_series(1001, 1700) i
on conflict do nothing;

insert into bookings (id, ref, guest_id, room_type_id, room_id, channel_id, arrive_on, depart_on, adults, children, status, deposit_cents, deposit_due_on, channel_ref, eta, requests, booked_on, checked_in_at, checked_out_at, long_stay_agreed) values
 ('55555555-0000-4000-8000-000000000001', 'K-1001', '44444444-0000-4000-8000-000000000001', '11111111-0000-4000-8000-000000000001', '22222222-0000-4000-8000-000000000001', '33333333-0000-4000-8000-000000000001', hotel_today() - 2, hotel_today(), 2, 0, 'checked_in', 0, null, '', '', 'Late checkout if possible', hotel_today() - 20, now() - interval '2 days', null, false),
 ('55555555-0000-4000-8000-000000000002', 'K-1002', '44444444-0000-4000-8000-000000000002', '11111111-0000-4000-8000-000000000002', '22222222-0000-4000-8000-000000000005', '33333333-0000-4000-8000-000000000002', hotel_today() - 1, hotel_today() + 2, 2, 1, 'checked_in', 0, null, 'BDC-4471203', '', '', hotel_today() - 30, now() - interval '1 day', null, false),
 ('55555555-0000-4000-8000-000000000003', 'K-1003', '44444444-0000-4000-8000-000000000003', '11111111-0000-4000-8000-000000000003', '22222222-0000-4000-8000-000000000009', '33333333-0000-4000-8000-000000000006', hotel_today() - 35, hotel_today() + 10, 4, 0, 'checked_in', 0, null, 'PO 7781', '', 'Crew of four, weekly invoice to accounts', hotel_today() - 50, now() - interval '35 days', null, false),
 ('55555555-0000-4000-8000-000000000004', 'K-1004', '44444444-0000-4000-8000-000000000004', '11111111-0000-4000-8000-000000000001', '22222222-0000-4000-8000-000000000002', '33333333-0000-4000-8000-000000000003', hotel_today(), hotel_today() + 2, 2, 0, 'confirmed', 0, null, 'EXP-99120034', '15:00', '', hotel_today() - 20, null, null, false),
 ('55555555-0000-4000-8000-000000000005', 'K-1005', '44444444-0000-4000-8000-000000000005', '11111111-0000-4000-8000-000000000002', null, '33333333-0000-4000-8000-000000000002', hotel_today(), hotel_today() + 3, 2, 0, 'confirmed', 0, null, 'BDC-4480911', '18:30', '', hotel_today() - 12, null, null, false),
 ('55555555-0000-4000-8000-000000000006', 'K-1006', '44444444-0000-4000-8000-000000000006', '11111111-0000-4000-8000-000000000001', null, '33333333-0000-4000-8000-000000000005', hotel_today() + 1, hotel_today() + 3, 2, 0, 'confirmed', 0, null, '', '', 'Unit 3 if free', hotel_today() - 5, null, null, false),
 ('55555555-0000-4000-8000-000000000007', 'K-1007', '44444444-0000-4000-8000-000000000007', '11111111-0000-4000-8000-000000000001', '22222222-0000-4000-8000-000000000003', '33333333-0000-4000-8000-000000000003', hotel_today() - 1, hotel_today() + 1, 1, 0, 'confirmed', 0, null, 'EXP-99118820', '', '', hotel_today() - 40, null, null, false),
 ('55555555-0000-4000-8000-000000000008', 'K-1008', '44444444-0000-4000-8000-000000000008', '11111111-0000-4000-8000-000000000003', '22222222-0000-4000-8000-000000000010', '33333333-0000-4000-8000-000000000001', hotel_today() + 20, hotel_today() + 24, 2, 3, 'confirmed', 27920, hotel_today() - 3, '', '', 'Cot please', hotel_today() - 10, null, null, false),
 ('55555555-0000-4000-8000-000000000009', 'K-1009', '44444444-0000-4000-8000-000000000009', '11111111-0000-4000-8000-000000000001', '22222222-0000-4000-8000-000000000004', '33333333-0000-4000-8000-000000000004', hotel_today() - 1, hotel_today(), 1, 0, 'checked_out', 0, null, '', '', '', hotel_today() - 1, now() - interval '1 day', now() - interval '2 hours', false),
 ('55555555-0000-4000-8000-000000000010', 'K-1010', '44444444-0000-4000-8000-000000000010', '11111111-0000-4000-8000-000000000002', '22222222-0000-4000-8000-000000000006', '33333333-0000-4000-8000-000000000004', hotel_today() - 12, hotel_today() - 5, 1, 0, 'checked_out', 0, null, '', '', '', hotel_today() - 12, now() - interval '12 days', now() - interval '5 days', false),
 ('55555555-0000-4000-8000-000000000011', 'K-1011', '44444444-0000-4000-8000-000000000011', '11111111-0000-4000-8000-000000000002', null, '33333333-0000-4000-8000-000000000001', hotel_today() + 30, hotel_today() + 33, 2, 0, 'enquiry', 0, null, '', '', 'Asked about ski hire', hotel_today() - 6, null, null, false),
 ('55555555-0000-4000-8000-000000000012', 'K-1012', '44444444-0000-4000-8000-000000000012', '11111111-0000-4000-8000-000000000002', '22222222-0000-4000-8000-000000000006', '33333333-0000-4000-8000-000000000002', hotel_today() + 5, hotel_today() + 8, 2, 0, 'confirmed', 0, null, 'BDC-4490155', '', '', hotel_today() - 9, null, null, false),
 ('55555555-0000-4000-8000-000000000013', 'K-1013', '44444444-0000-4000-8000-000000000013', '11111111-0000-4000-8000-000000000002', '22222222-0000-4000-8000-000000000006', '33333333-0000-4000-8000-000000000001', hotel_today() + 6, hotel_today() + 9, 2, 0, 'confirmed', 0, null, '', '', '', hotel_today() - 3, null, null, false),
 ('55555555-0000-4000-8000-000000000014', 'K-1014', '44444444-0000-4000-8000-000000000014', '11111111-0000-4000-8000-000000000002', '22222222-0000-4000-8000-000000000007', '33333333-0000-4000-8000-000000000003', hotel_today() + 4, hotel_today() + 6, 2, 0, 'confirmed', 0, null, 'EXP-99130077', '', '', hotel_today() - 15, null, null, false),
 ('55555555-0000-4000-8000-000000000015', 'K-0901', '44444444-0000-4000-8000-000000000015', '11111111-0000-4000-8000-000000000001', '22222222-0000-4000-8000-000000000003', '33333333-0000-4000-8000-000000000005', '2017-03-02', '2017-03-04', 2, 0, 'checked_out', 0, null, '', '', '', '2017-02-01', '2017-03-02', '2017-03-04', false)
on conflict do nothing;

-- The enquiry has had no reply for six days.
update bookings set updated_at = now() - interval '6 days' where ref = 'K-1011' and updated_at > now() - interval '1 hour';

-- Nights at the rate each carries: the rate plan covering that night, else the room type's base rate.
-- The contractors in Unit 9 are on an agreed rate.
insert into booking_nights (booking_id, night_on, rate_cents, rate_plan)
select b.id, d::date,
  case when b.ref = 'K-1003' then 25000 else coalesce(p.nightly_cents, t.base_rate_cents) end,
  case when b.ref = 'K-1003' then 'Contract rate' else coalesce(p.name, 'Base rate') end
from bookings b join room_types t on t.id = b.room_type_id
cross join lateral generate_series(b.arrive_on, b.depart_on - 1, interval '1 day') d
left join lateral (select name, nightly_cents from rate_plans r where r.room_type_id = b.room_type_id and d::date between r.starts_on and r.ends_on order by r.ends_on - r.starts_on limit 1) p on true
where b.ref like 'K-%'
on conflict do nothing;

insert into charges (id, booking_id, posted_on, kind, description, amount_cents) values
 ('77777777-0000-4000-8000-000000000001', '55555555-0000-4000-8000-000000000001', hotel_today() - 1, 'breakfast', 'Continental breakfast x2', 3000),
 ('77777777-0000-4000-8000-000000000002', '55555555-0000-4000-8000-000000000009', hotel_today() - 1, 'minibar', 'Minibar: wine and snacks', 1850),
 ('77777777-0000-4000-8000-000000000003', '55555555-0000-4000-8000-000000000003', hotel_today() - 7, 'laundry', 'Crew laundry, week 4', 4500)
on conflict do nothing;

insert into payments (id, booking_id, paid_on, kind, method, amount_cents, reference) values
 ('88888888-0000-4000-8000-000000000001', '55555555-0000-4000-8000-000000000001', hotel_today() - 2, 'payment', 'card', 39800, 'Stripe ch_demo_1001'),
 ('88888888-0000-4000-8000-000000000002', '55555555-0000-4000-8000-000000000002', hotel_today() - 1, 'payment', 'channel', 77700, 'Booking.com virtual card'),
 ('88888888-0000-4000-8000-000000000003', '55555555-0000-4000-8000-000000000003', hotel_today() - 28, 'payment', 'bank', 175000, 'Central Contracting week 1'),
 ('88888888-0000-4000-8000-000000000004', '55555555-0000-4000-8000-000000000003', hotel_today() - 21, 'payment', 'bank', 175000, 'Central Contracting week 2'),
 ('88888888-0000-4000-8000-000000000005', '55555555-0000-4000-8000-000000000003', hotel_today() - 14, 'payment', 'bank', 175000, 'Central Contracting week 3'),
 ('88888888-0000-4000-8000-000000000006', '55555555-0000-4000-8000-000000000003', hotel_today() - 7, 'payment', 'bank', 179500, 'Central Contracting week 4'),
 ('88888888-0000-4000-8000-000000000007', '55555555-0000-4000-8000-000000000004', hotel_today() - 20, 'payment', 'channel', 39800, 'Expedia collect'),
 ('88888888-0000-4000-8000-000000000008', '55555555-0000-4000-8000-000000000009', hotel_today() - 1, 'payment', 'eftpos', 19900, ''),
 ('88888888-0000-4000-8000-000000000009', '55555555-0000-4000-8000-000000000010', hotel_today() - 5, 'payment', 'card', 181300, ''),
 ('88888888-0000-4000-8000-000000000010', '55555555-0000-4000-8000-000000000015', '2017-03-04', 'payment', 'cash', 33800, '')
on conflict do nothing;

insert into invoices (id, number, booking_id, issued_on, total_cents, gst_cents) values
 ('99999999-0000-4000-8000-000000000001', 'INV-1001', '55555555-0000-4000-8000-000000000010', hotel_today() - 5, 181300, 23646),
 ('99999999-0000-4000-8000-000000000002', 'INV-0901', '55555555-0000-4000-8000-000000000015', '2017-03-04', 33800, 4409)
on conflict do nothing;

-- Unit 7 is also listed on Airbnb; its calendar says it is taken for three nights.
insert into blocks (id, room_id, starts_on, ends_on, source, uid, summary) values
 ('aaaaaaaa-0000-4000-8000-000000000001', '22222222-0000-4000-8000-000000000007', hotel_today() + 3, hotel_today() + 6, 'airbnb', 'demo-airbnb-7731@airbnb.com', 'Reserved')
on conflict do nothing;

-- About six months of past stays: two to three nights each, some gaps, a few cancellations.
insert into bookings (id, ref, guest_id, room_type_id, room_id, channel_id, arrive_on, depart_on, adults, status, booked_on, checked_in_at, checked_out_at, cancelled_on)
select gen_random_uuid(), 'H-' || lpad(r.sort::text, 2, '0') || lpad(s.n::text, 3, '0'),
  ('44444444-0000-4000-8000-0000000' || lpad((case when (s.n * 3 + r.sort) % 23 = 0 then 1001 + (s.n + r.sort) % 6 else 1010 + s.n * 10 + r.sort end)::text, 5, '0'))::uuid,
  r.room_type_id, r.id,
  case (s.n * 7 + r.sort) % 10 when 0 then '33333333-0000-4000-8000-000000000002'::uuid when 1 then '33333333-0000-4000-8000-000000000002'::uuid
    when 2 then '33333333-0000-4000-8000-000000000002'::uuid when 3 then '33333333-0000-4000-8000-000000000002'::uuid
    when 4 then '33333333-0000-4000-8000-000000000003'::uuid when 5 then '33333333-0000-4000-8000-000000000003'::uuid
    when 9 then '33333333-0000-4000-8000-000000000005'::uuid else '33333333-0000-4000-8000-000000000001'::uuid end,
  a.arrive, a.arrive + a.nights, 2,
  case when (s.n + r.sort) % 17 = 0 then 'cancelled' else 'checked_out' end,
  a.arrive - (3 + (s.n * 13 + r.sort) % 45),
  case when (s.n + r.sort) % 17 = 0 then null else a.arrive::timestamptz + interval '15 hours' end,
  case when (s.n + r.sort) % 17 = 0 then null else (a.arrive + a.nights)::timestamptz + interval '10 hours' end,
  case when (s.n + r.sort) % 17 = 0 then a.arrive - 2 end
from rooms r cross join generate_series(0, 60) s(n)
cross join lateral (select hotel_today() - 184 + s.n * 3 + r.sort % 3 arrive, 1 + (s.n + r.sort) % 3 nights) a
where r.status <> 'out_of_order' and (s.n + r.sort) % 5 <> 0 and a.arrive + a.nights <= hotel_today() - 3
  and not exists (select 1 from bookings x where x.room_id = r.id and x.ref like 'K-%' and x.arrive_on < a.arrive + a.nights and a.arrive < x.depart_on)
on conflict (ref) do nothing;

-- What is already on the books for the next two months, thinning out the further ahead it gets.
insert into bookings (id, ref, guest_id, room_type_id, room_id, channel_id, arrive_on, depart_on, adults, status, booked_on)
select gen_random_uuid(), 'F-' || lpad(r.sort::text, 2, '0') || lpad(s.n::text, 3, '0'),
  ('44444444-0000-4000-8000-0000000' || lpad((1650 + s.n * 2 + r.sort % 2)::text, 5, '0'))::uuid,
  r.room_type_id, r.id,
  case (s.n * 3 + r.sort) % 6 when 0 then '33333333-0000-4000-8000-000000000002'::uuid when 1 then '33333333-0000-4000-8000-000000000002'::uuid
    when 2 then '33333333-0000-4000-8000-000000000003'::uuid when 3 then '33333333-0000-4000-8000-000000000005'::uuid else '33333333-0000-4000-8000-000000000001'::uuid end,
  a.arrive, a.arrive + a.nights, 2, 'confirmed', greatest(hotel_today() - 40, a.arrive - (4 + (s.n * 11 + r.sort) % 50))
from rooms r cross join generate_series(0, 20) s(n)
cross join lateral (select hotel_today() + 3 + s.n * 3 + r.sort % 3 arrive, 1 + (s.n + r.sort) % 3 nights) a
where r.status <> 'out_of_order' and (s.n * 7 + r.sort * 3) % 10 < 7 - s.n / 3
  and not exists (select 1 from bookings x where x.room_id = r.id and x.ref like 'K-%' and x.arrive_on < a.arrive + a.nights + 1 and a.arrive - 1 < x.depart_on)
  and not exists (select 1 from blocks k where k.room_id = r.id and k.starts_on < a.arrive + a.nights and a.arrive < k.ends_on)
on conflict (ref) do nothing;

insert into booking_nights (booking_id, night_on, rate_cents, rate_plan)
select b.id, d::date, coalesce(p.nightly_cents, t.base_rate_cents), coalesce(p.name, 'Base rate')
from bookings b join room_types t on t.id = b.room_type_id
cross join lateral generate_series(b.arrive_on, b.depart_on - 1, interval '1 day') d
left join lateral (select name, nightly_cents from rate_plans r where r.room_type_id = b.room_type_id and d::date between r.starts_on and r.ends_on order by r.ends_on - r.starts_on limit 1) p on true
where b.ref ~ '^[HF]-'
on conflict do nothing;

insert into payments (booking_id, paid_on, kind, method, amount_cents, reference)
select v.id, v.depart_on - 1, 'payment', case when v.channel_kind = 'ota' then 'channel' else 'card' end, v.total_cents, 'demo'
from v_bookings v where v.ref like 'H-%' and v.status = 'checked_out' and v.total_cents > 0
  and not exists (select 1 from payments p where p.booking_id = v.id);

insert into invoices (number, booking_id, issued_on, total_cents, gst_cents)
select 'INV-H' || substr(f.ref, 3), f.id, f.depart_on - 1, f.total_cents, f.gst_cents
from v_folio f where f.ref like 'H-%' and f.status = 'checked_out'
on conflict do nothing;
