---
'@mastra/core': patch
---

Fixed state changes being lost when a nested workflow ran at the same time as other steps, in `.parallel()` or in `.foreach()` with a `concurrency` above 1. When the nested workflow finished or resumed, it replaced the workflow state with its own copy, dropping changes the other steps had made in the meantime. Now only the nested workflow's own changes are applied, so every step's changes are kept.
