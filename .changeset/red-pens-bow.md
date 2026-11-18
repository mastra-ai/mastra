---
'@mastra/factory': patch
---

Added an admin-gated `GET /web/admin/heap-snapshot` endpoint that streams a live `v8.getHeapSnapshot()` back to the caller. Off by default: requires `FACTORY_HEAP_SNAPSHOT=1` AND organization-administrator access in tenant mode (404/403 otherwise). Single-flight — concurrent requests return 409. Lets a maintainer pull a `.heapsnapshot` from a saturated production process without shell access.
