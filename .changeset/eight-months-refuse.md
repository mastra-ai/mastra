---
'@mastra/core': patch
---

Fixed custom `data-*` chunks emitted by tools via `writer.custom()` bypassing output processors. These chunks are now routed through the output processor pipeline before being enqueued to the stream. Processors must opt in by setting `processDataParts = true` to receive `data-*` chunks in `processOutputStream`.
