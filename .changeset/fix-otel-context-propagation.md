---
'@mastra/core': patch
---

Fixed trace context propagation in evented workflow steps and processors. Operations started inside those steps now appear under the correct parent in distributed traces.
