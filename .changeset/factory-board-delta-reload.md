---
'@mastra/factory': patch
---

Open boards stay fast on large projects. After a card changes, Factory now rereads only the cards that changed or were deleted instead of the whole board, and still does a full read at least once a minute.
