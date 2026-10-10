---
'@mastra/core': patch
---

Fixed two durable agent bugs:

- `Mastra.shutdown()` now closes the pubsub, so open Redis connections no longer keep the process running after shutdown.
- Read-only memory is now respected when a durable run finishes from a saved snapshot, so read-only turns are no longer saved.
