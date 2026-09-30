---
description: "Record a payment or deposit against a booking."
---
# Pay

Read CLAUDE.md first. Use fresh data and run:

```bash
npm run hotel -- pay <booking> <amount> [--method=card|eftpos|cash|bank|channel|voucher|other] [--reference=] [--deposit]
```

Report the new balance.

Answer in plain language, tables for numbers, in the property's currency. Ambiguous names list the candidates and exit 1: ask which one. Never invent a booking, a rate, a payment or a guest detail. Nothing here sends a message or charges a card: drafts go to drafts/ and a person acts.
