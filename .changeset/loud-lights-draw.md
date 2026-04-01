---
'@mastra/observability': patch
---

Fixed score and feedback annotations being dropped before spans flush by emitting from live correlation context when available. Scores and feedback can now also be stored without a trace ID when only contextual metadata is available.
