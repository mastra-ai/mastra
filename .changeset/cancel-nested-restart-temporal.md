---
'@mastra/temporal': patch
---

`run.cancel()` now returns `{ failed }`, listing any workflow run whose cancellation could not be saved.
