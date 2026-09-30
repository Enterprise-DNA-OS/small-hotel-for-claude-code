---
description: "Move a booking to another room, for example to fix a double booking or a room out of order."
---
# Move

Read CLAUDE.md first. Use fresh data and run:

```bash
npm run hotel -- move <booking> [room] [--force for a different room type]
```

A guest already in house moves from tonight; the old room is marked dirty.

Answer in plain language, tables for numbers, in the property's currency. Ambiguous names list the candidates and exit 1: ask which one. Never invent a booking, a rate, a payment or a guest detail. Nothing here sends a message or charges a card: drafts go to drafts/ and a person acts.
