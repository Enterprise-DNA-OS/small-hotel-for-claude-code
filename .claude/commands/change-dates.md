---
description: "Change the dates of a booking, or extend or shorten a stay in house."
---
# Change dates

Read CLAUDE.md first. Use fresh data and run:

```bash
npm run hotel -- change-dates <booking> <new check-in> <nights|check-out>   (in house: change-dates <booking> <new check-out>)
```

Nights already slept keep their rate; new nights are priced from the rate plans.

Answer in plain language, tables for numbers, in the property's currency. Ambiguous names list the candidates and exit 1: ask which one. Never invent a booking, a rate, a payment or a guest detail. Nothing here sends a message or charges a card: drafts go to drafts/ and a person acts.
