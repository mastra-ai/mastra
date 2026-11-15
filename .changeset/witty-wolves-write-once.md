---
'@mastra/client-js': patch
---

Stop the JavaScript client from repeating state-changing requests by default. A failed `POST`, `PUT`, `PATCH`, or `DELETE` is now sent a single time, so a server error cannot duplicate a side effect such as an agent generation or workflow start. Read requests (`GET`, `HEAD`, `OPTIONS`) still retry three times, and the observability queries that only read server state keep that read default even though they travel as `POST`: `aggregateTraces()`, `aggregateSpans()`, `queryTraceThreads()`, and `querySpans()`. Any other request retries again when `retries` is set explicitly on the client or the call.
