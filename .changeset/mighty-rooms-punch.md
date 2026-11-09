---
'@mastra/observability': minor
---

Added opt-in byte-based flush thresholds to `MastraPlatformExporter` and `MastraStorageExporter`, with configurable export concurrency:

```ts
new MastraPlatformExporter({ byteBatching: {} }) // 8 MiB flush threshold, up to two concurrent uploads
new MastraStorageExporter({ byteBatching: {} }) // 8 MiB flush threshold, one concurrent storage write
```

Byte thresholds trigger sending; they never truncate or discard records. Larger individual records are exported intact, and queued data is retained when exports fall behind. Queue memory is not capped. Byte batching is ignored for the `realtime` storage strategy. Existing count batching remains the default, and existing error and retry policies still apply.
