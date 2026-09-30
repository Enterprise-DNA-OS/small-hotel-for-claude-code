# Moving off Little Hotelier

Plan a quiet week. Run both side by side for a few days, then switch the channels over. Nothing here touches your Little Hotelier account: you export from it, and this system reads the file.

## 1. Set up the property first

Rooms and room types are the spine: bookings attach to them.

```bash
npm run hotel -- set settings --business-name="Your Motel" --country=NZ --currency=NZD --gst-rate=0.15 --gst-number=123-456-789 --booking-prefix=B-
npm run hotel -- add room-type --name="Studio" --base-rate=169 --max-guests=2
npm run hotel -- add room --name="Unit 1" --room-type=Studio --sort=1
npm run hotel -- add rate --name="Summer" --room-type=Studio --starts-on=2026-12-20 --ends-on=2027-02-28 --nightly=219 --min-nights=2
npm run hotel -- add channel --name="Booking.com" --kind=ota --commission-pct=15
```

Name rooms exactly as they appear in Little Hotelier, so imported bookings land in the right room. In Australia use `--country=AU --currency=AUD --gst-rate=0.10` and your ABN as the GST number.

## 2. Export your reservations

Little Hotelier lets you search reservations and export the results as a CSV file, and its reports export to CSV from the Export button. Two limits from its Help Centre:

- The reservation search reaches reservations created or checked out within the last 548 days. Older ones cannot be accessed, so export what you want to keep before you close the account.
- Guest information is masked 180 days after check-out. Masked guests come across as "Masked guest <reference>" with no contact details.

Export future bookings and the last 18 months of history, as CSV.

## 3. Import, dry run first

```bash
npm run hotel -- import little-hotelier reservations.csv                      # a dry run: counts and notes, nothing saved
npm run hotel -- import little-hotelier reservations.csv --date-order=dmy     # when dates like 03/04/2026 could be either way round
npm run hotel -- import little-hotelier reservations.csv --date-order=dmy --apply
```

Running the same file again adds nothing. A bad row stops the whole file and saves nothing.

### What maps

Column names differ between Little Hotelier's reports, so each field accepts several names (case does not matter):

| Field | Column names read |
|---|---|
| Booking reference | Reservation ID, Booking Reference, Booking Ref, Booking ID, Reservation Number, Confirmation Number, Booking Number, ID |
| Guest | Guest Name, Guest, Name, Booker, Customer; or Guest First Name / First Name with Guest Last Name / Last Name / Surname |
| Email, phone | Email, Guest Email, Email Address; Phone, Guest Phone, Phone Number, Mobile |
| Check-in, check-out | Check In, Check-in, Check In Date, Arrival, Arrival Date; Check Out, Check-out, Check Out Date, Departure, Departure Date |
| Room type, room | Room Type, Room Type Name, Room Category; Room Number, Room Name, Room No, Unit, Room |
| Guests | Adults, Number of Adults; Children, Number of Children |
| Money | Total, Total Amount, Total Price, Booking Total, Grand Total, Amount; Amount Paid, Paid, Payment Received, Total Paid |
| Channel | Channel, Channel Name, Source, Booking Source, Booking Channel |
| Status | Status, Booking Status, Reservation Status (cancelled, no show, checked out, checked in, else confirmed) |
| Booked on | Booked On, Booking Date, Date Booked, Created, Created Date |

- Guests are matched by email, then by name and phone. New ones are created.
- A room type or channel that does not exist yet is created. Set each new channel's commission afterwards (`set channel <name> --commission-pct=`).
- The booking total is spread evenly across the nights. Payments come across as one line per booking.
- Every original row is kept on the booking (`source_data`) and in `import_rows`, so nothing in the file is lost.

### What does not carry over

- Rate plans, restrictions and room inventory rules: set these up again with `add rate`.
- Payment card details and Little Hotelier Payments transactions. Cards stay with your payment provider.
- Guest reviews, messages and the booking engine's look.
- Anything older than Little Hotelier's 548-day search window.

## 4. Keep the online channels in step

Little Hotelier's channel manager pushes rates and availability to Booking.com, Expedia and others over live connections. The free version does not hold those connections. What it does:

- **Calendars in:** save each listing's iCal export (Airbnb, Booking.com and Vrbo all offer one) and run `npm run hotel -- import ical "Unit 7" unit7.ics --source=airbnb --apply`. Its events become blocks on that room, and a block the feed no longer lists is removed. Run it on a schedule.
- **Calendars out:** `npm run hotel -- ical-export feeds --exclude-source=airbnb` writes one `.ics` file per room with every sold night marked "Not available" and no guest names. Put the folder somewhere the channel can read it (any static file host) and paste each room's link into the channel's calendar import.
- iCal sync runs on the channel's timetable, often a few hours apart, so a room can still be sold twice in between. `/conflicts` and `/attention` show every clash.

A live two-way channel connection is something Enterprise DNA builds into a customised version when a property needs one.

## 5. Switch over

1. Import, then compare `/bookings` and `/arrivals` with Little Hotelier for the next two weeks.
2. Point each channel at your new calendar feeds, and import theirs.
3. Take new direct bookings here.
4. Export once more from Little Hotelier on the last day, import with `--apply` (only new references are added), then close the account.
