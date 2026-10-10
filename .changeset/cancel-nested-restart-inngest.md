---
'@mastra/inngest': patch
---

`run.cancel()` now returns `{ failed }` to match `@mastra/core`. For Inngest runs the list is always empty; storage errors are still thrown. Canceling an Inngest run does not cancel its nested workflow runs.
