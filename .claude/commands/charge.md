---
description: "Add an extra to a folio: breakfast, minibar, laundry, a fee, or a discount."
---
# Charge

Read CLAUDE.md first. Use fresh data and run:

```bash
npm run hotel -- charge <booking> <amount> "<description>" [--kind=extra|breakfast|minibar|laundry|fee|discount|other] [--no-gst]
```

Amounts include GST unless --no-gst.

Answer in plain language, tables for numbers, in the property's currency. Ambiguous names list the candidates and exit 1: ask which one. Never invent a booking, a rate, a payment or a guest detail. Nothing here sends a message or charges a card: drafts go to drafts/ and a person acts.
