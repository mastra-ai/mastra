---
'@mastra/core': patch
---

Fixed custom `data-*` chunks emitted by tools via `writer.custom()` bypassing output processors. These chunks are now routed through the output processor pipeline before being enqueued to the stream, so processors can inspect, modify, or block them.
