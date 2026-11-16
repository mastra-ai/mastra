---
'@mastra/factory': patch
---

A person can no longer move a busy Factory card into a phase that starts a run. While a run is in flight on the card's sessions or queued for it, the transition service refuses the move with the new `card_busy` rejection code and the reason "Another run can't start while this card is busy." Moving a busy card to a resting or terminal phase, such as closing it, still works, and agent, rule and run-start moves are not affected.
