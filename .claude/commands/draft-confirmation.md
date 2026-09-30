---
description: "Draft a booking confirmation email to the guest."
---
# Draft confirmation

Read CLAUDE.md first. Use fresh data and run:

```bash
npm run hotel -- draft-confirmation <booking>
```

Show the draft. Nothing is sent.

Answer in plain language, tables for numbers, in the property's currency. Ambiguous names list the candidates and exit 1: ask which one. Never invent a booking, a rate, a payment or a guest detail. Nothing here sends a message or charges a card: drafts go to drafts/ and a person acts.
