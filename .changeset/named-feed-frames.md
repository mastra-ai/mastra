---
'@mastra/factory': patch
---

Each board stream frame now names the cards that changed: `{"cards":["<card id>"]}` for a card write, `{"cards":[]}` when only decisions or runs moved, and `{}` when the server cannot tell which cards changed. Open boards can reread those cards alone instead of the whole session card list. Older browsers ignore the field and keep rereading everything.
