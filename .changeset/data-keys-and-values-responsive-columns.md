---
'@mastra/playground-ui': patch
---

`DataKeysAndValues` with `numOfCol={2}` or `numOfCol={3}` now falls back to one column when its container is too narrow, instead of squeezing every column side by side. `TraceKeysAndValues` gets the same layout from it, so it no longer overrides the grid itself.
