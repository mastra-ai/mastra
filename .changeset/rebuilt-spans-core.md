---
'@mastra/core': patch
---

Added optional `batchUpdateUnendedSpans()` to observability storage. It updates only spans that are stored and haven't ended, never creates rows, and returns the spans it changed. The in-memory store implements it. Also added the `span-not-updatable` drop reason for span updates that didn't apply. Part of the fix for [#27479](https://github.com/mastra-ai/mastra/issues/27479).
