---
'@mastra/core': patch
---

Improved cancellation of durable and evented agent tool and model calls after execution ownership is lost. Cooperative tools receive an abort signal so superseded work can stop sooner without canceling the recovering run. Recovery may run a tool again, so tools must be safe to repeat. Cancellation cannot undo work already completed.
