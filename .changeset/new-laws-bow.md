---
'@mastra/core': patch
---

Fixed `stream(..., { untilIdle: true })` repeating earlier output when a background task triggers a follow-up turn. The supplied `runId` can abort the initial or follow-up turn through `abortRunStream(runId)` or `abortThreadStream(...)`.
