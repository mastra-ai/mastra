---
'@mastra/pg': minor
---

Spans now store nine native fields in their own columns: `externalParentSpanId`, `resumedFromSpanId`, `model`, `provider`, `outcome`, `stopReason`, `stopReasonContext`, `timeToFirstTokenMs` and `errorCount`. Existing databases get the columns automatically when the store starts. The columns stay empty for spans written before the upgrade, with an older `@mastra/core`, or by producers that do not set them yet.
