---
"@mastra/core": patch
---

Await `storage.init()` before workers start in `startWorkers()`.

The scheduler worker runs an immediate warm-up tick on start, which can
dispatch an internal scheduled workflow (the notification dispatcher, enabled
by default) and persist a workflow snapshot. Without awaiting `storage.init()`
first, that write could race the lazy initialization that creates the
`mastra_workflow_snapshot` table, surfacing as repeated
`SQLITE_ERROR: no such table: mastra_workflow_snapshot` on SQL stores like
libSQL (#17905). `init()` is idempotent and a no-op when storage init is
disabled.
