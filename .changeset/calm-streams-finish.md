---
'@mastra/core': patch
---

Prevent `streamLegacy()` cleanup from hanging when an observer stream has queued events that have not been consumed.
