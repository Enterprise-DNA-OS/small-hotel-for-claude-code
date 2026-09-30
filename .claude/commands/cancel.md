---
description: "Cancel a booking or enquiry, with a cancellation fee if your terms allow one."
---
# Cancel

Read CLAUDE.md first. Use fresh data and run:

```bash
npm run hotel -- cancel <booking> [--fee=] [--reason=]
```

Say what was paid and what to refund or keep, by your terms. Never refund without a yes.

Answer in plain language, tables for numbers, in the property's currency. Ambiguous names list the candidates and exit 1: ask which one. Never invent a booking, a rate, a payment or a guest detail. Nothing here sends a message or charges a card: drafts go to drafts/ and a person acts.
