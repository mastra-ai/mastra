---
'@mastra/core': minor
---

Span records now carry nine native fields in their own columns: `externalParentSpanId`, `resumedFromSpanId`, `model`, `provider`, `outcome`, `stopReason`, `stopReasonContext`, `timeToFirstTokenMs` and `errorCount`. Exported spans can supply them, the storage exporters copy them as given, and a field the span does not set is stored as `null`. Agent, model, tool, and workflow tracing populate execution outcomes and stop-reason details. Other fields are supplied when available.
