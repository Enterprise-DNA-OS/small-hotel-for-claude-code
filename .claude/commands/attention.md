---
description: "Everything that needs a decision today, from every part of the property."
---
# Attention

Read CLAUDE.md first. Use fresh data and run:

```bash
npm run hotel -- attention
```

Group by reason. For each, say the next action and the command that does it (assign, pay, check-out, cancel or no-show, move, room-status).

Answer in plain language, tables for numbers, in the property's currency. Ambiguous names list the candidates and exit 1: ask which one. Never invent a booking, a rate, a payment or a guest detail. Nothing here sends a message or charges a card: drafts go to drafts/ and a person acts.
