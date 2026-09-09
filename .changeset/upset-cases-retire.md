---
'@mastra/react': patch
---

Fixed the chat message accumulator throwing when a `start` chunk arrives without a `payload`, so previously recorded thread streams still render.
