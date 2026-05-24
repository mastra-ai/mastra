---
'@mastra/core': patch
---

**Added durable queue scheduling.** `QueuedItem` now carries optional `priority` (higher drains first; defaults to 0) and `deadline` (epoch ms; drain refuses to start past this point). The drain step runs a per-iteration CAS that:

- drops every item past its deadline, emits `queue_item_expired`, and marks the queue admission receipt `failed` in the same write;
- rotates the highest-priority survivor to the head of `pendingQueue` so the existing `pendingQueue[0]` recovery contract stays intact.

Same-priority items keep FIFO order via `enqueuedAt` tie-break. Items without a priority or deadline behave exactly like before — pure FIFO. No storage migration: the new fields ride along inside the existing `pending_queue` JSONB column.
