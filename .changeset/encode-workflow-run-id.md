---
'@mastra/client-js': patch
---

Fixed workflow run methods failing with `404 Workflow run not found` when the run id contains characters like `+`, `&`, `#` or `/`. `start`, `resume`, `restart`, `timeTravel` (and their async/stream variants), `cancel`, `runById` and `deleteRunById` now URL-encode the run id, matching `createRun` and `startAsync`.
