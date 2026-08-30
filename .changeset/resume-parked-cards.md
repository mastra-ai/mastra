---
'@mastra/factory': patch
---

A card parked in Intake now offers Resume as its primary action.

Once a seat's run had ever started, its action disappeared from the card — a parked card kept only "Open session", so the one way back into Reviewing was dragging it there. Resume restarts the deepest used seat's run, continuing in the same thread and branch, and the card re-enters that seat's lane exactly like a fresh Start. A parked suggestion still wins the primary slot.
