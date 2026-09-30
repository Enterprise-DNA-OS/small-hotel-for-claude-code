---
description: "Record a refund already made."
---
# Refund

Read CLAUDE.md first. Use fresh data and run:

```bash
npm run hotel -- refund <booking> <amount> [--method=] [--reference=]
```

This records a refund; it does not send money. Make the refund in your payment system first.

Answer in plain language, tables for numbers, in the property's currency. Ambiguous names list the candidates and exit 1: ask which one. Never invent a booking, a rate, a payment or a guest detail. Nothing here sends a message or charges a card: drafts go to drafts/ and a person acts.
