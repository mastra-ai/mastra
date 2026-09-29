---
'@mastra/core': patch
---

Fixed evented workflow snapshots growing quadratically with `.foreach()` input size. Each iteration's progress record no longer stores a copy of the whole input array, so large foreach runs no longer produce huge snapshots that can stall storage. Fixes #24943.
