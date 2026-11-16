---
'@mastra/factory': patch
---

Fixed Factory sessions losing the ability to move their card. A session that had worked on a card could stop being offered `factory_transition_work_item` while the card was still open, for example after sitting idle for a day, so the card stayed where it was until a person moved it. The session now keeps the tool and the board decides each move.

A finished card can be reopened from its session when a person asks, where the board allows it. Refused moves are now logged with a `[factory:move]` line.
