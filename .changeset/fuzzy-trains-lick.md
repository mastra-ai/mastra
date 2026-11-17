---
'@mastra/observability': patch
---

Fixed the storage exporter dropping a span end that reached storage before the span's create row. This happens when a worker process ends a span that the API process started. Under `batch-with-updates`, the end is now retried, so Studio shows the real outcome instead of a trace that stays open. A `span-not-updatable` drop for such an end now arrives after the retries run out, not right away.
