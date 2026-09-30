---
description: "One booking's whole story: nights and rates, extras, payments, balance, invoice, notes."
---
# Booking

Read CLAUDE.md first. Use fresh data and run:

```bash
npm run hotel -- booking <ref or guest name>
```

Read this before drafting anything about a stay.

Answer in plain language, tables for numbers, in the property's currency. Ambiguous names list the candidates and exit 1: ask which one. Never invent a booking, a rate, a payment or a guest detail. Nothing here sends a message or charges a card: drafts go to drafts/ and a person acts.
