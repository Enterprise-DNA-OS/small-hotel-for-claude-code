---
description: "Check a guest in, into their room or the best free one."
---
# Check in

Read CLAUDE.md first. Use fresh data and run:

```bash
npm run hotel -- check-in <booking> [--room=]
```

A dirty room stops the check-in: mark it clean with /room-status first. Mention any balance to take.

Answer in plain language, tables for numbers, in the property's currency. Ambiguous names list the candidates and exit 1: ask which one. Never invent a booking, a rate, a payment or a guest detail. Nothing here sends a message or charges a card: drafts go to drafts/ and a person acts.
