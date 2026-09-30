---
description: "Mark a room clean, dirty, inspected, or out of order (with a reason and a date it is due back)."
---
# Room status

Read CLAUDE.md first. Use fresh data and run:

```bash
npm run hotel -- room-status <room> <clean|dirty|inspected|out_of_order> [--reason=] [--until=YYYY-MM-DD] [--by=]
```

Taking a room out of order lists the bookings that need moving: offer /move for each.

Answer in plain language, tables for numbers, in the property's currency. Ambiguous names list the candidates and exit 1: ask which one. Never invent a booking, a rate, a payment or a guest detail. Nothing here sends a message or charges a card: drafts go to drafts/ and a person acts.
