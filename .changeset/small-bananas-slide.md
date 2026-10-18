---
'@mastra/client-js': minor
---

Added context and parent/root entity fields to `querySpans()` response types.

**Breaking:** `querySpans()` response types no longer include `cost`, `inputTruncated`, `outputTruncated` and `errorTruncated`.
