---
description: "Take a booking or an enquiry: guest, room type, dates, channel, deposit."
---
# Book

Read CLAUDE.md first. Use fresh data and run:

```bash
npm run hotel -- book "<guest>" <room type> <check-in> <nights|check-out> [--room=] [--channel=] [--email=] [--phone=] [--adults=] [--children=] [--rate=] [--deposit=] [--eta=] [--requests=] [--channel-ref=] [--long-stay] [--enquiry] [--new-guest]
```

Quote first if the guest has not agreed a price. Use --long-stay when a stay over four weeks was agreed up front (it changes the GST value in New Zealand). Offer /draft-confirmation after.

Answer in plain language, tables for numbers, in the property's currency. Ambiguous names list the candidates and exit 1: ask which one. Never invent a booking, a rate, a payment or a guest detail. Nothing here sends a message or charges a card: drafts go to drafts/ and a person acts.
