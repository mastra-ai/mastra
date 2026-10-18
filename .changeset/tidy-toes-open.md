---
'@mastra/core': patch
---

Improved cancellation of durable and evented agent tool and model calls after execution ownership is lost. Cooperative tools receive an abort signal so superseded work can stop sooner without canceling the recovering run. Tools must still be idempotent because cancellation cannot undo side effects or guarantee exactly-once execution.
