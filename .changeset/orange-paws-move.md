---
'@mastra/spanner': patch
---

Fixed trace deletion to remove trace-linked metrics when Spanner metrics storage is enabled while preserving metric records without a trace ID.
