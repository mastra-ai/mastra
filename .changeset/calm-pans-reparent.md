---
"@mastra/observability": patch
---

Fixed span exports when `excludeSpanTypes` removes a parent span. Descendant spans now use the nearest exported parent, so exporters retain tool calls.
