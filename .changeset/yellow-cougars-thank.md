---
'@mastra/factory': patch
---

Added `heap_total`, `external`, and `array_buffers` to the `mastra_factory_process_memory_bytes` metric, plus a new `mastra_factory_process_heap_space_bytes{space}` metric that breaks heap_total down per v8 heap space. These make it possible to tell apart v8 holding committed heap it isn't using, large external/arraybuffer payloads, and allocator/native overhead (rss − heap_total − external) when a Factory process's RSS stays high after a burst while heap drops.
