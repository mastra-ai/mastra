---
'@mastra/client-js': patch
---

Span types returned by the trace and span endpoints now include the native `externalParentSpanId`, `resumedFromSpanId`, `model`, `provider`, `outcome`, `stopReason`, `stopReasonContext`, `timeToFirstTokenMs` and `errorCount` fields.
