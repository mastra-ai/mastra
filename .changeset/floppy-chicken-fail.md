---
'@mastra/factory': patch
---

Fixed the Factory board briefly failing with "Board item … has no work item …" when someone deleted a card while the board was refreshing. The deleted card now just disappears from the board, and looking up a card while it is being deleted finds nothing instead of failing.
