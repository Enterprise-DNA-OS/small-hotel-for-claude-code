<h1 align="center">Small Hotel for Claude Code</h1>

<p align="center">
  <strong>The open-source motel, B&B and small hotel property management system that is just a database and Claude Code.</strong>
</p>

<p align="center">
  Created by <a href="https://www.enterprisedna.co"><strong>Enterprise DNA</strong></a>. Free and open source. Works with Claude Code, Codex, OpenCode or Cursor.
</p>

<!-- three-doors -->
<table align="center">
  <tr>
    <td align="center"><strong>Do it yourself</strong><br/>Clone it, run it, own it. Free, MIT.<br/><a href="#quick-start">Quick start</a></td>
    <td align="center"><strong>We customise it</strong><br/>Your fields, your rules, your Little Hotelier data brought across.<br/><a href="https://enterprisedna.co/omni/book/?utm_source=github&utm_medium=readme&utm_campaign=little-hotelier">Book a call</a></td>
    <td align="center"><strong>We run it for you</strong><br/>Installed, connected and operated inside Omni. Setup fee, then a retainer.<br/><a href="https://enterprisedna.co/omni/instead-of/little-hotelier?utm_source=github&utm_medium=readme&utm_campaign=little-hotelier">How it works</a></td>
  </tr>
</table>

<p align="center">
  <a href="#what-is-this">What is this</a> &bull;
  <a href="#why-no-front-end">Why no front end</a> &bull;
  <a href="#quick-start">Quick start</a> &bull;
  <a href="#the-commands">Commands</a> &bull;
  <a href="#instead-of-little-hotelier">Instead of Little Hotelier</a> &bull;
  <a href="#want-it-installed-and-run-for-you">Installed for you</a> &bull;
  <a href="#license">License</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Node-20+-339933?style=flat-square" alt="Node 20+" />
  <img src="https://img.shields.io/badge/PostgreSQL-any-336791?style=flat-square" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/PGlite-embedded-3ecf8e?style=flat-square" alt="PGlite" />
  <img src="https://img.shields.io/badge/License-MIT-yellow?style=flat-square" alt="MIT License" />
</p>

---

## What is this

Small Hotel for Claude Code does the job you pay Little Hotelier for, as a Postgres database and a set of agent commands. There is no web front end. You open the folder in [Claude Code](https://claude.com/claude-code) (or Codex, OpenCode, Cursor: see `AGENTS.md`) and ask for what you want in plain language. It runs the right query, and it can answer questions the Little Hotelier dashboard cannot.

Little Hotelier prices each property by plan and room count. For New Zealand and Australia its pricing page lists Basics at $49 a month plus a 1% booking fee, and Pro from $179 a month for up to 5 rooms, $215 for 10, $305 for 20 and $345 for 30, before tax, with add-ons such as the website builder on top ([littlehotelier.com/pricing](https://www.littlehotelier.com/pricing/), read 30 September 2026). A 20-room motel on Pro pays $3,660 a year, every year, and a group of three pays it three times.

Want the same thing with a web front end, or built on a different stack? That is a customisation, and it is exactly what Enterprise DNA does: [book a call](https://enterprisedna.co/omni/book/?utm_source=github&utm_medium=readme&utm_campaign=little-hotelier).

It covers the front desk and the back office of a motel, B&B, lodge or small hotel: rooms and room types, seasonal rates and minimum stays, bookings night by night, folios with extras and payments, tax invoices with GST worked out (including the reduced value for long stays in New Zealand and the long-term concession in Australia), housekeeping, the night audit, outside calendars from Airbnb and Booking.com by iCal, and occupancy, ADR, RevPAR and channel commission. It is built for owner-operated properties of 5 to 50 rooms in New Zealand and Australia, where the owner is also the front desk.

## What it does every day and every week

- **Morning at the desk** (`/attention`, `/arrivals`, `/housekeeping`): who arrives with no room, which dirty room has a guest coming, who is leaving owing money.
- **Check-in and check-out** (`/check-in`, `/charge`, `/pay`, `/check-out`): the folio, the balance, the tax invoice, the room back to housekeeping.
- **The night audit** (`/night-audit`): stayovers set for service, arrivals that never came, tonight in numbers, and the evacuation roll printed.
- **Keeping the channels honest** (`/conflicts`, `/import`, `/ical-export`): no room sold twice across your bookings and Airbnb or Booking.com.
- **Monday review** (`/weekly-review`): soft weeks ahead, this week's pickup, deposits to chase, and what each channel cost in commission.

## Ten questions the Little Hotelier dashboard does not answer out of the box

Little Hotelier has reports and insights on its plans. These are questions you can ask here in plain words, each answered by a command today, and you can change any of them.

1. What did each booking channel earn us after commission this year, and what did the commission cost in total? `/channel-mix`
2. What is our occupancy, average rate and RevPAR by month for the last twelve months, next to what is already on the books? `/occupancy`
3. Which weeks in the next three months are soft enough to need a rate change or a push? `/forecast`
4. What did we pick up in the last seven days, and for which months? `/pickup`
5. Which rooms are sold twice, across our own bookings and the Airbnb calendar? `/conflicts`
6. Who has left owing us money, and who are we holding money for? `/balances`
7. Which long stays carry GST on the reduced value, and which invoices over $1,000 are missing the guest's details? `/compliance`
8. Which regulars still book through a commission channel instead of coming to us direct? `/repeat-guests`
9. Which enquiries have had no reply for three days? `/attention`
10. Which guest records are past our privacy review date, and which notes have a card number written in them? `/compliance`

## Your first hour: ten things to ask for

1. "Put our name, logo and colours on the invoices and registration cards" (edit `brand.json`, then `npm run docs`).
2. "Set us up: twelve units, three room types, these base rates, our GST number."
3. "Add our summer and school holiday rates, with a two-night minimum at Christmas."
4. "Import our Little Hotelier reservations export as a test run."
5. "Import the Airbnb calendar for Unit 7 and tell me if anything clashes."
6. "What needs doing this morning?"
7. "Book Sarah Jones into a studio for three nights from Friday and draft her confirmation."
8. "Check out Unit 4, take the balance on eftpos and print the invoice."
9. "How did September compare with August, and which channel cost us most?"
10. "Add a vehicle registration field to the registration card." (`/customise`)

## Why no front end

- The front end was only ever there because the database was hard to talk to. That is no longer true.
- Your data sits in plain Postgres tables you own. Any tool can read them. No export, no lock-in.
- No seats, no tiers, no add-ons. Read [docs/why-no-front-end.md](docs/why-no-front-end.md) for the honest trade-offs too.

## Quick start

Sixty seconds, no database install (an embedded Postgres runs inside Node):

```bash
git clone https://github.com/Enterprise-DNA-OS/small-hotel-for-claude-code.git
cd small-hotel-for-claude-code
npm install
npm run demo
```

Then open the folder in Claude Code and type `/attention` to see what needs a decision this morning, or `/housekeeping` for the room board. The demo is Kowhai Lodge Motel, a fictional ten-unit motel in Wanaka with six months of stays behind it, a contracting crew on a 45-night stay, a guest arriving to a dirty room, a double booking, a clash with the Airbnb calendar and a deposit overdue.

### Use it with your own Postgres or Supabase

Copy `.env.example` to `.env`, set `DATABASE_URL`, then `npm run migrate`. Same commands, shared data, no per-seat fee.

## The commands

| Command | What it does |
|---|---|
| `/attention` | Everything needing a decision today |
| `/weekly-review` | The Monday review: soft weeks, pickup, deposits, channels |
| `/arrivals`, `/departures`, `/in-house` | Who arrives, leaves and stays, with balances |
| `/housekeeping`, `/room-status` | The room board; mark rooms clean, inspected or out of order |
| `/night-audit` | End of day: stayovers, not arrived, tonight in numbers |
| `/availability`, `/quote`, `/book` | Rooms free by night; price a stay; take a booking or enquiry |
| `/assign`, `/move`, `/change-dates` | Put a booking in a room, move it, change its dates |
| `/check-in`, `/check-out` | Arrive and leave, with the tax invoice issued at check-out |
| `/charge`, `/pay`, `/refund` | The folio: extras, payments, refunds recorded |
| `/cancel`, `/no-show` | With a fee when your terms allow one |
| `/booking`, `/guest`, `/bookings` | One stay, one guest, the next 60 days |
| `/balances`, `/deposits` | Who owes, who is owed, deposits due and overdue |
| `/conflicts` | Rooms sold twice, including against outside calendars |
| `/occupancy`, `/forecast`, `/pickup` | Occupancy, ADR and RevPAR; the weeks ahead; this week's bookings |
| `/channel-mix`, `/repeat-guests`, `/cancellations` | What each channel really earns; regulars; lost bookings |
| `/compliance` | Long-stay GST, invoice details, privacy and card-data checks, each with its source |
| `/invoices`, `/rooms`, `/rates`, `/channels`, `/guests` | The records |
| `/draft-confirmation`, `/draft-prearrival`, `/draft-deposit-reminder`, `/draft-review-request` | Guest emails drafted to `drafts/`. Nothing sends |
| `/import`, `/ical-export`, `/export` | Little Hotelier and iCal in; calendars out; everything out |
| `/add`, `/set`, `/log`, `/activity` | Add or change any record or setting; notes; the audit trail |
| `/customise`, `/new-view` | Make it yours; add a dashboard page |

`npm run view` renders the `today` and `performance` dashboards to `views/`. `npm run docs` renders tax invoices, registration cards, the housekeeping sheet and the evacuation roll to `docs-out/`, in your brand. Full reference: [docs/cli.md](docs/cli.md).

## Instead of Little Hotelier

Set up your rooms and room types, export your reservations from Little Hotelier's reservation search as CSV, then:

```bash
npm run hotel -- import little-hotelier reservations.csv --date-order=dmy            # a dry run first
npm run hotel -- import little-hotelier reservations.csv --date-order=dmy --apply
npm run hotel -- import ical "Unit 7" airbnb-unit-7.ics --source=airbnb --apply     # each outside calendar, per room
```

Guests are matched by email, new room types and channels are created, every original column is kept, and a second run adds nothing. Little Hotelier's search reaches back 548 days and masks guest details 180 days after check-out, so export before you close the account. Rate plans and the live channel connections are set up again. [docs/replace-little-hotelier.md](docs/replace-little-hotelier.md) has the column map and what does not carry over.

## Checks, not advice

[docs/compliance.md](docs/compliance.md) lists every record check with its Inland Revenue, ATO or Privacy Commissioner source. A clean check means the records are complete, not that your tax is right. Nothing here sends email, charges a card or pushes to a channel: drafts go to `drafts/` and a person acts.

## Architecture

```
small-hotel-for-claude-code/
  CLAUDE.md                 how the operator wants this run (routing table + house rules)
  AGENTS.md                 the same, for Codex / OpenCode / Cursor / Gemini CLI
  .claude/commands/         the slash commands
  scripts/hotel.mjs         the CLI the commands drive
  scripts/lib/domain.mjs    every report as one query
  scripts/lib/import.mjs    the Little Hotelier and iCal importers, the iCal export
  scripts/lib/db.mjs        one adapter: DATABASE_URL (pg) or embedded PGlite
  supabase/migrations/      plain SQL schema
  supabase/seed.sql         demo data
  docs/                     compliance sources, the Little Hotelier guide, the CLI reference
  views.json, documents.json  dashboards and paperwork, rendered in brand.json
```

## Built for coding agents

The database, CLI and command recipes work with Claude Code, Codex, OpenCode or Cursor. Ask your coding agent for a new command and have it implement and test the change against the same records.

## Contributing

Issues and pull requests are welcome. Keep the shape: plain SQL, a small CLI, a slash command per recurring job, no front end.

## Want it installed and run for you?

Enterprise DNA installs Small Hotel for Claude Code for your business, migrates your Little Hotelier data, connects it to the rest of your tools, and runs it for you as part of **Omni**, our managed Command Center. One setup fee, then a monthly retainer.

- Book a call: [enterprisedna.co/omni/book](https://enterprisedna.co/omni/book/?offer=replace-software&utm_source=github&utm_medium=readme&utm_campaign=little-hotelier)
- Read more: [enterprisedna.co/omni/instead-of/little-hotelier](https://enterprisedna.co/omni/instead-of/little-hotelier?utm_source=github&utm_medium=readme&utm_campaign=little-hotelier)

## License

MIT. Copyright (c) 2026 Enterprise DNA. Not affiliated with Little Hotelier, SiteMinder, Inland Revenue, the ATO or Anthropic. Little Hotelier is a trademark of its owner.
