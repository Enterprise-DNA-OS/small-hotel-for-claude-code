---
description: "The last 30 tax invoices issued."
---
# Invoices

Read CLAUDE.md first. Use fresh data and run:

```bash
npm run hotel -- invoices
```

Offer npm run docs -- tax-invoice to print one.

Answer in plain language, tables for numbers, in the property's currency. Ambiguous names list the candidates and exit 1: ask which one. Never invent a booking, a rate, a payment or a guest detail. Nothing here sends a message or charges a card: drafts go to drafts/ and a person acts.
