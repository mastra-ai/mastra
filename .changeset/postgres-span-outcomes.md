---
'@mastra/pg': patch
---

Fixed span reads on Postgres dropping how a span ended. `getSpan`, `getRootSpan`, `getTrace` and `listTraces` now return `outcome`, `stopReason`, `stopReasonContext` and `resumedFromSpanId`.
