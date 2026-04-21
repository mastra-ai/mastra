---
'@mastra/client-js': patch
---

Added `observabilityRuntimeStrategy` to `GetSystemPackagesResponse` so clients can read the active observability tracing strategy (`realtime`, `batch-with-updates`, `insert-only`, or `event-sourced`) reported by the server.
