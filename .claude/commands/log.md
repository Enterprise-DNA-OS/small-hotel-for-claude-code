---
description: "Add a note to a booking, guest or room."
---
# Log

Read CLAUDE.md first. Use fresh data and run:

```bash
npm run hotel -- log <booking|guest|room> "<note>"
```

Answer in plain language, tables for numbers, in the property's currency. Ambiguous names list the candidates and exit 1: ask which one. Never invent a booking, a rate, a payment or a guest detail. Nothing here sends a message or charges a card: drafts go to drafts/ and a person acts.
