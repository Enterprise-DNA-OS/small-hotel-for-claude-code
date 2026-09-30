---
description: "Channels and their commission rates."
---
# Channels

Read CLAUDE.md first. Use fresh data and run:

```bash
npm run hotel -- channels
```

Set a rate with /set channel <name> --commission-pct=

Answer in plain language, tables for numbers, in the property's currency. Ambiguous names list the candidates and exit 1: ask which one. Never invent a booking, a rate, a payment or a guest detail. Nothing here sends a message or charges a card: drafts go to drafts/ and a person acts.
