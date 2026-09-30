---
description: "Rate plans (seasons, events, minimum stays) and base rates by room type."
---
# Rates

Read CLAUDE.md first. Use fresh data and run:

```bash
npm run hotel -- rates
```

Use /add rate to add a season and /set rate to change one.

Answer in plain language, tables for numbers, in the property's currency. Ambiguous names list the candidates and exit 1: ask which one. Never invent a booking, a rate, a payment or a guest detail. Nothing here sends a message or charges a card: drafts go to drafts/ and a person acts.
