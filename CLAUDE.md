# Small Hotel for Claude Code: operating instructions

This file is the brain. Claude Code reads it at the start of every session. It says who this is for, how work gets done, and the one right way to do each recurring job.

## Who this is for

- **Business:** [YOUR BUSINESS]
- **Operator:** [YOUR NAME], [your role]
- **What matters most:** [the one or two outcomes you care about]

Fill this in once. A worker with context knows. A worker without it guesses.

## How to work

1. **Take a brief, not a script.** The operator describes the outcome. You run the right command and present the answer.
2. **Read before you write.** Before drafting anything about a record, read its full history first.
3. **Plain language.** Short sentences. No filler. Numbers in tables.
4. **Silent success, loud problems.** No play-by-play. Say what broke and what you did about it.
5. **Stop at the line.** Anything that sends, deletes, or faces a customer waits for a yes in this session.

## Routing table: one right way for each recurring job

| When the operator asks for... | Use this |
|---|---|
| What needs doing this morning | `/attention`, then `/arrivals` and `/housekeeping` |
| The Monday review | `/weekly-review` |
| Is there a room, what would it cost, book it | `/availability`, `/quote`, `/book`, then `/draft-confirmation` |
| Put a booking in a room, move it, change dates | `/assign`, `/move`, `/change-dates` |
| A guest arrives or leaves | `/check-in`; `/charge`, `/pay`, then `/check-out` |
| A cancellation or a guest who never came | `/cancel`, `/no-show` |
| Rooms to clean, a room out of order | `/housekeeping`, `/room-status` |
| End of the day | `/night-audit` |
| One booking or one guest's whole story | `/booking`, `/guest` |
| Money owed, deposits, refunds | `/balances`, `/deposits`, `/draft-deposit-reminder`, `/refund` |
| A room sold twice | `/conflicts`, then `/move` |
| How are we doing: occupancy, rate, channels, the weeks ahead | `/occupancy`, `/channel-mix`, `/forecast`, `/pickup`, `/repeat-guests`, `/cancellations` |
| Are our records in order (GST, invoices, privacy) | `/compliance` (rules and sources in docs/compliance.md) |
| Guest emails | `/draft-confirmation`, `/draft-prearrival`, `/draft-deposit-reminder`, `/draft-review-request` |
| Invoices, registration cards, housekeeping sheet, evacuation roll | `npm run docs`; `/invoices` |
| Moving off Little Hotelier, Airbnb or Booking.com calendars | `/import` (read docs/replace-little-hotelier.md), `/ical-export`, `/export` |
| Rooms, rates, channels, guests, settings, notes | `/add`, `/set`, `/log`, `/rooms`, `/rates`, `/channels`, `/guests`, `/activity` |
| A new field, rule or rate type | `/customise` |
| A new dashboard page | `/new-view` |

If an ask fits nothing here, run the CLI directly (`npm run hotel -- help`, reference in docs/cli.md) and then propose a new command for it.

## Hard rules

- Never send email or messages from here. Draft to `drafts/`, a person sends.
- Never delete records without an explicit yes in this session. Prefer marking closed or archived.
- Never invent a record. If a name is ambiguous, list the candidates and ask.
- The database is the source of truth. If the answer is not in it, say so.
- Never invent a booking, a rate, a payment or a guest detail. Ask for the confirmation, the receipt or the channel's booking.
- Never take a card number into a note or a draft. Cards stay with the payment provider.
- Recording a payment or a refund does not move money. Say so when you record one.
- Guest names never go into the calendar feeds.
- Nothing here is tax advice. Say so when a check comes back clean.
- Import with a dry run first. Never seed a real database.

## House details (fill in once)

- Check-in from [time], check-out by [time]. After-hours key collection: [where].
- Deposit and cancellation terms: [your terms]. Payment link or bank account for deposits: [details].
- Review link: [link].

## Where things live

- `scripts/` the CLI. `scripts/lib/db.mjs` picks `DATABASE_URL` (Postgres, Supabase) or the embedded database in `.data/`.
- `supabase/migrations/` the schema, plain SQL. `npm run migrate` applies it.
- `.claude/commands/` the slash commands. Add one every time the same ask comes twice.
- `docs/` compliance sources, the guide for moving off Little Hotelier, the CLI reference.

Built by Enterprise DNA. Installed and run for you as part of Omni: https://enterprisedna.co/omni/instead-of/little-hotelier
