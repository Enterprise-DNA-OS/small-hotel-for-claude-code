---
description: "Rooms sold twice: two bookings, or a booking and an outside calendar block."
---
# Conflicts

Read CLAUDE.md first. Use fresh data and run:

```bash
npm run hotel -- conflicts
```

For each, suggest the move that fixes it (/availability, then /move).

Answer in plain language, tables for numbers, in the property's currency. Ambiguous names list the candidates and exit 1: ask which one. Never invent a booking, a rate, a payment or a guest detail. Nothing here sends a message or charges a card: drafts go to drafts/ and a person acts.
