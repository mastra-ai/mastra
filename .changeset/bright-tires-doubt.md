---
'@mastra/factory': patch
---

Fixed Factory run bindings accumulating forever and slowing the dispatcher. Bindings are now revoked automatically when a work item reaches a terminal stage (after a final reconcile so trailing tool results are still ingested), a slow-cadence sweep revokes stale or orphaned bindings (older than 24 hours or whose work item is gone or already finished), and the bound-thread reconcile walk now runs every 30 seconds off the dispatch claim path instead of blocking every 1-second tick, skipping bindings whose work item can no longer act before reading any messages.
