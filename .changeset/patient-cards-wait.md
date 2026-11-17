---
'@mastra/factory': patch
---

Fixed Factory sessions being cut off from a card they were still working on. A cleanup that runs every 10 minutes ended a session's assignment to its card once the assignment was a day old, even when the card was still open in that session's phase. The session then lost its card tools and was told its part was done, so the card stayed put until a person moved it. The cleanup now leaves a session on its card while the card is still open in the phase that session works.
