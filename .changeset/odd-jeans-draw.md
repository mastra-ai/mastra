---
'@mastra/observability': patch
'@mastra/core': patch
---

Fixed `spanFilter` so a dropped span is dropped whole. Its start, update, and end events are all skipped, and its child spans now attach to the nearest exported ancestor instead of pointing at a span exporters never receive. The filter runs once, when the span starts, on the span's creation data.
