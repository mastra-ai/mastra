---
'@mastra/observability': patch
---

Fixed unnecessary JSON parse exceptions when filtering serialized span markers, reducing synchronous tracing overhead while preserving JSON redaction.
