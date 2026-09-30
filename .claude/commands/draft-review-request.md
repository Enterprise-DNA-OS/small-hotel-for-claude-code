---
description: "Draft a thank-you and review request after check-out, with a reason to book direct next time."
---
# Draft review request

Read CLAUDE.md first. Use fresh data and run:

```bash
npm run hotel -- draft-review-request <booking>
```

Add the review link before a person sends it.

Answer in plain language, tables for numbers, in the property's currency. Ambiguous names list the candidates and exit 1: ask which one. Never invent a booking, a rate, a payment or a guest detail. Nothing here sends a message or charges a card: drafts go to drafts/ and a person acts.
