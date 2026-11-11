---
'@mastra/factory': patch
---

Factory sessions bound to a card no longer read every card on the board on each model step to find the card's parent and children. Those are now read directly, so busy boards stay fast while cards change.
