---
'@mastra/client-js': patch
---

Trace query requests (`queryTraces`, `aggregateTraces`, `querySpans`, `queryTraceThreads`) no longer retry when the server reports a query execution timeout (504 with code `TRACE_QUERY_EXECUTION_TIMEOUT`). Retrying re-ran the same expensive query against the same timeout and could make a failing call take over a minute. Other 5xx errors, including 504s from proxies or gateways, are still retried.
