---
description: "The room board: which rooms to clean first, stayovers, check-outs, out of order."
---
# Housekeeping

Read CLAUDE.md first. Use fresh data and run:

```bash
npm run hotel -- housekeeping
```

Rooms with a guest arriving come first. Offer to print the sheet with npm run docs -- housekeeping-sheet.

Answer in plain language, tables for numbers, in the property's currency. Ambiguous names list the candidates and exit 1: ask which one. Never invent a booking, a rate, a payment or a guest detail. Nothing here sends a message or charges a card: drafts go to drafts/ and a person acts.
