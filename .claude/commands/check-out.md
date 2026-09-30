---
description: "Check a guest out, issue the tax invoice, and set the room for cleaning."
---
# Check out

Read CLAUDE.md first. Use fresh data and run:

```bash
npm run hotel -- check-out <booking> [--owing]
```

A balance stops the check-out: take it with /pay, or use --owing and chase it. Leaving early takes the unused nights off the bill.

Answer in plain language, tables for numbers, in the property's currency. Ambiguous names list the candidates and exit 1: ask which one. Never invent a booking, a rate, a payment or a guest detail. Nothing here sends a message or charges a card: drafts go to drafts/ and a person acts.
