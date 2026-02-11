---
'@mastra/core': patch
---

Fixed `generateTitle` running on every conversation turn instead of only the first, which caused redundant title generation calls. This happened when `lastMessages` was disabled or set to `false`. Titles are now correctly generated only on the first turn.
