---
description: "Write one calendar file per room for Airbnb, Booking.com or Vrbo to read, so they stop selling nights you have sold."
---
# Ical export

Read CLAUDE.md first. Use fresh data and run:

```bash
npm run hotel -- ical-export [folder] [--room=] [--exclude-source=airbnb]
```

Events say "Not available": no guest names leave. Publishing the files at a web address is a setup step; see docs/replace-little-hotelier.md.

Answer in plain language, tables for numbers, in the property's currency. Ambiguous names list the candidates and exit 1: ask which one. Never invent a booking, a rate, a payment or a guest detail. Nothing here sends a message or charges a card: drafts go to drafts/ and a person acts.
