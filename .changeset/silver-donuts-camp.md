---
'@mastra/server': minor
---

Added context and parent/root entity fields to `querySpans()`.

**Breaking:** `querySpans()` no longer accepts `model` and `provider` filters or returns `cost`, `inputTruncated`, `outputTruncated` and `errorTruncated`.
