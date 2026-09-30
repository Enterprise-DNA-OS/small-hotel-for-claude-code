---
description: "Put a booking in a room: the one named, or the best free room of its type."
---
# Assign

Read CLAUDE.md first. Use fresh data and run:

```bash
npm run hotel -- assign <booking> [room]
```

Inspected rooms go first, then clean ones.

Answer in plain language, tables for numbers, in the property's currency. Ambiguous names list the candidates and exit 1: ask which one. Never invent a booking, a rate, a payment or a guest detail. Nothing here sends a message or charges a card: drafts go to drafts/ and a person acts.
