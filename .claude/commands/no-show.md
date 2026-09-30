---
description: "Record a guest who did not arrive, with a no-show fee if your terms allow one."
---
# No show

Read CLAUDE.md first. Use fresh data and run:

```bash
npm run hotel -- no-show <booking> [--fee=]
```

Check the booking with the guest or channel first if you can.

Answer in plain language, tables for numbers, in the property's currency. Ambiguous names list the candidates and exit 1: ask which one. Never invent a booking, a rate, a payment or a guest detail. Nothing here sends a message or charges a card: drafts go to drafts/ and a person acts.
