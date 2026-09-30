---
description: "Change a record or a setting."
---
# Set

Read CLAUDE.md first. Use fresh data and run:

```bash
npm run hotel -- set <room-type|room|rate|channel|guest|booking> <name> --field=value   |   set settings --field=value
```

Settings: business-name, country, currency, gst-rate, gst-number, deposit-pct, deposit-days, long-stay-nights, au-long-stay-concession, quiet-days, privacy-review-years.

Answer in plain language, tables for numbers, in the property's currency. Ambiguous names list the candidates and exit 1: ask which one. Never invent a booking, a rate, a payment or a guest detail. Nothing here sends a message or charges a card: drafts go to drafts/ and a person acts.
