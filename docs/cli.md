# The hotel CLI

`npm run hotel -- <command> [args] [--flags]`. Every slash command runs one of these. Output is a table; add `--json` for machines. Names match an exact id or name first, then a fragment of either. A booking matches its reference or the guest's name; among several, the one still open wins. When more than one matches, the candidates are listed and the command exits 1. Dates are YYYY-MM-DD or day first (DD/MM/YYYY).

## Reports

| Command | What it answers |
|---|---|
| `attention` | Everything needing a decision: unassigned arrivals, double bookings, no-shows, overstays, balances, overdue deposits, missing invoices, quiet enquiries, rooms not ready, rooms past their out-of-order date |
| `arrivals`, `departures`, `in-house` | Today's and tomorrow's arrivals with ETA and balance; who is due out; who is staying |
| `housekeeping` | Every room with the job it needs, rooms with an arrival first |
| `availability [--from=] [--nights=14]` | Rooms free by type, night by night |
| `bookings` | Enquiries and bookings for the next 60 days |
| `booking <ref or guest>` | Nights and rates, charges, payments, balance, GST, invoice, notes |
| `guest <name>` | Details, every stay, notes |
| `balances`, `deposits` | Who owes, who is owed; deposits paid, due, overdue |
| `conflicts` | Rooms sold twice, including against imported calendars |
| `occupancy` | Occupancy, ADR and RevPAR by month, actual and on the books |
| `channel-mix` | Revenue, commission and net by channel, lead time, cancellations |
| `forecast`, `pickup` | Twelve weeks on the books; bookings taken in the last seven days |
| `repeat-guests`, `cancellations` | Guests who come back; cancellations and no-shows with fees |
| `compliance` | The record checks in docs/compliance.md |
| `invoices`, `rooms`, `room-types`, `rates`, `channels`, `guests`, `blocks` | The records |
| `weekly-review` | attention, forecast, pickup, deposits and channels together |
| `activity` | Notes and the audit trail |

## Actions

All actions run in one transaction and are written to `audit`. Money is entered in dollars and includes GST.

| Command | Notes |
|---|---|
| `quote <room type> <check-in> <nights\|check-out> [--rate=]` | Rate plans first (the shortest covering each night), else the base rate. Minimum stays apply |
| `book "<guest>" <room type> <check-in> <nights\|check-out> [...]` | Flags: room, channel, email, phone, country, adults, children, rate, deposit, eta, requests, channel-ref, long-stay, enquiry, new-guest, force. Refuses a room that is taken, a type that is full, too many guests, a past date or a do-not-rebook guest unless `--force`. Direct bookings carry the house deposit; OTA bookings none |
| `assign <booking> [room]`, `move <booking> [room]` | Best free room of the type: inspected, then clean. `--force` moves to another type at the booked rate |
| `change-dates <booking> <check-in> <nights\|check-out>` | In house: `change-dates <booking> <check-out>`. Slept nights keep their rate |
| `check-in <booking> [--room=]` | Not before the arrival date; not into a dirty room without `--force` |
| `check-out <booking> [--owing]` | Early departure takes unused nights off. A balance stops it unless `--owing`. Issues the tax invoice; room set dirty |
| `cancel <booking> [--fee=] [--reason=]`, `no-show <booking> [--fee=]` | Fees post as a cancellation charge |
| `charge <booking> <amount> "<description>" [--kind=] [--no-gst]` | Kinds: extra, breakfast, minibar, laundry, fee, discount, other |
| `pay <booking> <amount> [--method=] [--reference=] [--deposit]`, `refund <booking> <amount>` | A refund cannot exceed what was paid |
| `room-status <room> <clean\|dirty\|inspected\|out_of_order> [--reason=] [--until=] [--by=]` | Out of order needs a reason and lists bookings to move |
| `night-audit` | Stayover rooms set dirty; not-arrived bookings listed; tonight's occupancy and room revenue |
| `add <room-type\|room\|rate\|channel\|guest> --field=value` | Room type: name code base-rate max-guests description. Room: name room-type property sort active. Rate: name room-type starts-on ends-on nightly min-nights. Channel: name kind commission-pct. Guest: name email phone address country company business-number vip do-not-rebook marketing-ok notes |
| `set <type> <name> --field=value`, `set settings --field=value` | Booking: adults children channel channel-ref eta requests deposit deposit-due-on long-stay-agreed |
| `log <booking\|guest\|room> "<note>"` | |
| `import little-hotelier <file.csv> [--date-order=dmy\|mdy] [--apply]` | See docs/replace-little-hotelier.md. Dry run by default |
| `import ical <room> <file.ics> --source=<name> [--apply]` | The feed replaces its own future blocks on that room |
| `ical-export [folder] [--room=] [--exclude-source=]` | One .ics per room, "Not available" events, no guest names |
| `export <file.json>` | Every table, one file |
| `draft-confirmation`, `draft-prearrival [booking] [--days=2]`, `draft-deposit-reminder`, `draft-review-request` | Drafts to drafts/. Nothing sends |

## Documents and views

`npm run docs` renders, in brand.json's name and colours: tax invoices (last 30 days), registration cards (arrivals today and tomorrow), the housekeeping sheet, and the evacuation roll of who is in the building tonight. `npm run docs -- tax-invoice` renders one type. `npm run view` renders the `today` and `performance` dashboards to `views/`.
