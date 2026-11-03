---
'@mastra/observability': patch
---

Fixed the storage exporter dropping a span end that reached storage before the span's create row. This happens when a worker process ends a span that the API process started. The end is now retried on the exporter's backoff budget, so Studio shows the real outcome instead of a trace that stays open. Calling `flush()` sends a waiting end too, without spending a retry, so a worker that flushes before it exits ends the span once the API has stored it. An end still waiting for a retry when the exporter shuts down is reported as a drop that reaches your monitoring exporter before shutdown resolves, instead of being lost silently.
