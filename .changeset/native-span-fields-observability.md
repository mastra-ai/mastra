---
'@mastra/observability': patch
---

Spans keep the native `resumedFromSpanId`, `model`, `provider`, `outcome` and `stopReason` fields when they are exported, snapshotted and rebuilt, so values set by a producer survive durable and multi-worker runs.
