---
'@mastra/client-js': patch
---

Updated generated `querySpans()` response types with context and parent/root entity fields. Removed `cost`, `inputTruncated`, `outputTruncated` and `errorTruncated` from those types; update callers that read these fields. Model/provider values and previews remain available.
