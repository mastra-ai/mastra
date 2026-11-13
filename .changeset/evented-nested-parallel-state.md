---
'@mastra/core': patch
---

Fixed nested workflows losing their `setState()` updates on the evented engine when they run as a branch of `.parallel()` or `.branch()` and a sibling branch finishes after them. The nested workflow's state changes now merge with the other branches' updates regardless of finish order, matching the default engine.
