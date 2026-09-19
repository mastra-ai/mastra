---
'@mastra/core': patch
---

Fixed claimed thread owners acting on a redelivered idle signal twice. A signal that a PubSub backend redelivers is now handled once, so it no longer queues the turn again or starts a second run for the same run id. If the reply to the caller never reached the backend, the redelivery re-sends it instead of reprocessing the signal.
