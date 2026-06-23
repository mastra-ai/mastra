---
'@mastra/server': patch
---

Added a `serializeStreamChunk` helper to `@mastra/server/server-adapter` that server adapters use to safely serialize stream chunks. It converts values that JSON cannot represent (BigInt to string, circular references to "[Circular]") and reports a serialization error instead of throwing, so one bad chunk can no longer terminate an HTTP stream. Part of the fix for [#17821](https://github.com/mastra-ai/mastra/issues/17821)
