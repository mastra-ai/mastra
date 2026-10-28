---
'@mastra/core': minor
---

Span records now carry nine native fields in their own columns: `externalParentSpanId`, `resumedFromSpanId`, `model`, `provider`, `outcome`, `stopReason`, `stopReasonContext`, `timeToFirstTokenMs` and `errorCount`. Exported spans can supply them, the storage exporters copy them as given, and a field the span does not set is stored as `null`. This release only adds the fields; later releases fill them in.
