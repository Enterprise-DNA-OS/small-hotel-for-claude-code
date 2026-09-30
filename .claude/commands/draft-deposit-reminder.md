---
description: "Draft a reminder for an overdue deposit."
---
# Draft deposit reminder

Read CLAUDE.md first. Use fresh data and run:

```bash
npm run hotel -- draft-deposit-reminder <booking>
```

Add the payment link or account before a person sends it.

Answer in plain language, tables for numbers, in the property's currency. Ambiguous names list the candidates and exit 1: ask which one. Never invent a booking, a rate, a payment or a guest detail. Nothing here sends a message or charges a card: drafts go to drafts/ and a person acts.
