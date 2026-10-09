---
'@mastra/core': patch
---

Fixed stored signals rendering different markup after they are reloaded from storage. Signal attributes now render in a stable order, so the same message produces the same prompt text on every turn.
