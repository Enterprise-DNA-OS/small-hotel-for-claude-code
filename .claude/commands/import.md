---
description: "Bring bookings across from a Little Hotelier reservations export, or an outside calendar (Airbnb, Booking.com, Vrbo) for one room."
---
# Import

Read CLAUDE.md first. Use fresh data and run:

```bash
npm run hotel -- import little-hotelier <reservations.csv> [--date-order=dmy|mdy] [--apply]
npm run hotel -- import ical <room> <calendar.ics> --source=airbnb [--apply]
```

Read docs/replace-little-hotelier.md. Rooms and room types first, then reservations. Run without --apply first and report the counts and notes. Apply only when the operator agrees.

Answer in plain language, tables for numbers, in the property's currency. Ambiguous names list the candidates and exit 1: ask which one. Never invent a booking, a rate, a payment or a guest detail. Nothing here sends a message or charges a card: drafts go to drafts/ and a person acts.
