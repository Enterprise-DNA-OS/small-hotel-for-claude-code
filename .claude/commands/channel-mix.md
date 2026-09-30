---
description: "What each channel earns after commission, lead time and cancellations."
---
# Channel mix

Read CLAUDE.md first. Use fresh data and run:

```bash
npm run hotel -- channel-mix
```

Say what the OTA commission cost this year and how much of it a direct booking push could win back.

Answer in plain language, tables for numbers, in the property's currency. Ambiguous names list the candidates and exit 1: ask which one. Never invent a booking, a rate, a payment or a guest detail. Nothing here sends a message or charges a card: drafts go to drafts/ and a person acts.
