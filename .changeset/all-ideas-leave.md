---
'@mastra/temporal': patch
---

Fixed `run.start()` on Temporal workflows returning `steps: {}`. It now returns one record per step with `status`, `output`, `startedAt` and `endedAt`, plus the workflow `input`, like a local run. Nested workflows are keyed by their Mastra workflow id, as in a local run; after `.parallel()` with a nested workflow, the next step now gets that workflow's output under that id too. Workers must run this version for the records to appear; a run finished by an older Worker still returns `steps: {}`. Fixes #28307.
