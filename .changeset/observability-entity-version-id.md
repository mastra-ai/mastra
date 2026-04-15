---
'@mastra/observability': patch
---

Added `entityVersionId`, `parentEntityVersionId`, and `rootEntityVersionId` to span correlation context, enabling version information to propagate to scores, metrics, logs, and feedback emitted during traced execution.
