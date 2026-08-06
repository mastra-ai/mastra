---
'@mastra/clickhouse': patch
---

Fixed the ClickHouse lightweight trace list: responses no longer carry the `input`, `output` and `attributes` payload blobs, and delta polling now works.

`listTracesLight` rows now carry a short `inputPreview` in place of the full input, plus the span `metadata` and a computed `status`, so Studio's configurable trace columns keep working — in both page and delta mode. Response payloads stay small as prompts grow. There is no schema change and no migration.

Requires `@mastra/core` >= 1.57.0, which ships the shared `buildInputPreview` and `computeTraceStatus` helpers this store now imports (peer dependency bumped accordingly).
