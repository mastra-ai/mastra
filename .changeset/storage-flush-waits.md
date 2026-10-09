---
'@mastra/observability': patch
---

Fixed `flush()` and `shutdown()` on the storage exporter returning before batches already being written to storage had finished. Closing storage or ending a serverless handler right after awaiting them no longer risks losing those spans, logs, metrics and scores. Fixes [#26482](https://github.com/mastra-ai/mastra/issues/26482).
