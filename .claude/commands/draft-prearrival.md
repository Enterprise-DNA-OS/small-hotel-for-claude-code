---
description: "Draft pre-arrival notes for everyone arriving in the next two days, or one booking."
---
# Draft prearrival

Read CLAUDE.md first. Use fresh data and run:

```bash
npm run hotel -- draft-prearrival [booking] [--days=2]
```

Fill the check-in time and key collection from CLAUDE.md before showing the drafts.

Answer in plain language, tables for numbers, in the property's currency. Ambiguous names list the candidates and exit 1: ask which one. Never invent a booking, a rate, a payment or a guest detail. Nothing here sends a message or charges a card: drafts go to drafts/ and a person acts.
