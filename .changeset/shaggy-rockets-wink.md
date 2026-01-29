---
'@mastra/observability': patch
'@mastra/core': patch
---

Tracing fixes:
- Spans now inherit entityType/entityId from the closest non-internal parent (#12250)
- Processor spans correctly track separate input and output data
- Model chunk spans are now emitted for all streaming chunks
- Internal framework spans no longer appear in exported traces
