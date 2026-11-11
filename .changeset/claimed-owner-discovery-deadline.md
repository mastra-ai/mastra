---
'@mastra/core': patch
---

Fixed claimed-owner discovery sending one extra request right at its 1 s deadline when a timer fired a millisecond early.
