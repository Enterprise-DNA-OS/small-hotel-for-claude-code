---
description: "Today's and tomorrow's arrivals: room, ETA, balance to take, requests."
---
# Arrivals

Read CLAUDE.md first. Use fresh data and run:

```bash
npm run hotel -- arrivals
```

Flag anyone with no room, a balance to collect on arrival, or a request to prepare for. Suggest /assign for unassigned bookings.

Answer in plain language, tables for numbers, in the property's currency. Ambiguous names list the candidates and exit 1: ask which one. Never invent a booking, a rate, a payment or a guest detail. Nothing here sends a message or charges a card: drafts go to drafts/ and a person acts.
