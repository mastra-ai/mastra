---
'@mastra/langfuse': patch
---

Fixed the Langfuse trace name, input, output, and metadata being replaced when a second agent or workflow run is started inside an existing trace with `tracingOptions.parentSpanId`. A nested run, such as an LLM judge, now only adds its spans, and the outer run keeps the trace summary.
