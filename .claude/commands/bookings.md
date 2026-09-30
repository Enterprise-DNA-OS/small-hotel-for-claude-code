---
description: "Enquiries and bookings for the next 60 days."
---
# Bookings

Read CLAUDE.md first. Use fresh data and run:

```bash
npm run hotel -- bookings
```

Group by status.

Answer in plain language, tables for numbers, in the property's currency. Ambiguous names list the candidates and exit 1: ask which one. Never invent a booking, a rate, a payment or a guest detail. Nothing here sends a message or charges a card: drafts go to drafts/ and a person acts.
