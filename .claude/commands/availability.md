---
description: "Rooms free by type, night by night, for the next two weeks or any window."
---
# Availability

Read CLAUDE.md first. Use fresh data and run:

```bash
npm run hotel -- availability [--from=YYYY-MM-DD] [--nights=14]
```

Point out nights with nothing left and nights with plenty.

Answer in plain language, tables for numbers, in the property's currency. Ambiguous names list the candidates and exit 1: ask which one. Never invent a booking, a rate, a payment or a guest detail. Nothing here sends a message or charges a card: drafts go to drafts/ and a person acts.
