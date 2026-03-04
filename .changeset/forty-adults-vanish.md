---
'@mastra/core': minor
---

Added `streamParts` to `processOutputResult` args, giving processors direct access to all accumulated stream chunks (including the finish chunk with usage data) after generation completes. Previously, usage data and other chunk metadata were only available in `processOutputStream`.
