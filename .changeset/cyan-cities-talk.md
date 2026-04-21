---
'@mastra/server': minor
---

The system packages endpoint (`GET /api/system/packages`) now reports the active observability tracing strategy (`realtime`, `batch-with-updates`, `insert-only`, or `event-sourced`) as `observabilityRuntimeStrategy`. Clients can use this to tailor polling / refresh behavior in the studio to what the attached store actually supports.

Added `tags`, `hideInput`, and `hideOutput` to the shared `tracingOptionsSchema` used by agent and workflow routes so callers can annotate spans with tags and redact input / output per request.
