---
'@mastra/core': patch
'@mastra/libsql': patch
'@mastra/pg': patch
---

**Added durable session cancellation.** New `Session.cancel({reason?, requestedBy?})` and `Session.cancelQueuedItem({queuedItemId, reason?})` APIs on Harness v1 sessions. `cancel(...)` is idempotent — the first call wins; it aborts the in-flight turn, removes every pending queued item from the durable queue, rejects their resolvers with `HarnessSessionCancelledError`, and persists a `cancelRequest` marker on `SessionRecord`. The harness heartbeat short-circuits lease renewal when the marker is set, so cancelled sessions release their lease naturally instead of being kept alive.

Two new events ship with the primitive: `task_cancellation_requested` (session-scope verdict) and `queue_item_cancelled` (one per removed queued turn).

Storage adapters wire-up the new `cancel_request` JSONB column on `mastra_harness_sessions` — schema migration is automatic via the existing `alterTable({ifNotExists})` path, so existing deployments pick it up at next init.
