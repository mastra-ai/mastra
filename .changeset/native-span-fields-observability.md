---
'@mastra/observability': patch
---

Spans keep the native `resumedFromSpanId`, `outcome`, `stopReason` and `stopReasonContext` fields when they are exported, snapshotted and rebuilt, so values set by a producer survive durable and multi-worker runs.
