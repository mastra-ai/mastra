---
'@mastra/core': patch
---

Fixed background-eligible tools running inline when an evented agent run executes on a dedicated worker (for example an API with `MASTRA_WORKERS=false` plus worker processes). The worker now dispatches them as background tasks, as a single process does, and still respects `disableBackgroundTasks` and `backgroundTaskPolicy` on the run. Fixes #31090.
