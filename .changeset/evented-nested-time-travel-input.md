---
'@mastra/core': patch
---

Fixed time travel to a step inside a nested workflow on the evented engine. The step now re-runs with the input recorded in the run instead of `{}`, and time travel to a step inside a nested `.foreach()` no longer hangs.
