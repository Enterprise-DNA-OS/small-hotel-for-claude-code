---
description: "End of day: stayover rooms set for service, arrivals that never came, tonight in numbers."
---
# Night audit

Read CLAUDE.md first. Use fresh data and run:

```bash
npm run hotel -- night-audit
```

Report tonight's occupancy and room revenue. For each booking not arrived, ask whether to record a no-show (/no-show, with any fee the terms allow) or wait. Offer to print the evacuation roll: npm run docs -- fire-roll.

Answer in plain language, tables for numbers, in the property's currency. Ambiguous names list the candidates and exit 1: ask which one. Never invent a booking, a rate, a payment or a guest detail. Nothing here sends a message or charges a card: drafts go to drafts/ and a person acts.
