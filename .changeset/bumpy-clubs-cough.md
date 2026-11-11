---
'@mastra/core': patch
---

Fixed evented workflow runs running a step once per booting replica. When several instances restart active runs at the same time, the worker running a step now holds a lease on it, so another instance waits for that step instead of running it again, and concurrent `restart()` calls on one run restart it once. A step whose worker crashed runs again once that worker's lease expires. Workflows with `autoRestartActiveRuns: false` are unchanged. Fixes #28712.
