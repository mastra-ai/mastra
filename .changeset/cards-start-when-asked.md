---
'@mastra/factory': patch
---

Factory sessions now start a card when someone asks for the work to be done now ("fix it", "go for it"), instead of filing it and leaving it in the backlog. A card is left unstarted only when the person asked for it to be filed or tracked for later. Afterwards the session reports only what it can confirm: the stage the card moved to, the side session it started, or the refusal or approval the move is waiting on.
