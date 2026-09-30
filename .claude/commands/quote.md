---
description: "Price a stay for a room type and dates, and say whether it can be booked."
---
# Quote

Read CLAUDE.md first. Use fresh data and run:

```bash
npm run hotel -- quote <room type> <check-in> <nights|check-out> [--rate=]
```

Show the nightly rates and the total including GST.

Answer in plain language, tables for numbers, in the property's currency. Ambiguous names list the candidates and exit 1: ask which one. Never invent a booking, a rate, a payment or a guest detail. Nothing here sends a message or charges a card: drafts go to drafts/ and a person acts.
