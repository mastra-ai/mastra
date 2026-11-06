---
'@mastra/observability': minor
---

Added opt-in byte-based flush thresholds to `MastraPlatformExporter` and `MastraStorageExporter`, with configurable export concurrency:

```ts
new MastraPlatformExporter({ byteBatching: {} }) // 8 MiB flush threshold, two uploads
new MastraStorageExporter({ byteBatching: {} }) // 8 MiB flush threshold, one storage write
```

Byte thresholds trigger sending; they never truncate or discard records. Larger individual records are exported intact, and queued data is retained when exports fall behind. Queue memory is not capped. Existing count batching remains the default, and existing error and retry policies still apply.
