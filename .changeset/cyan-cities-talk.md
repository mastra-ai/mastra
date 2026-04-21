---
'@mastra/server': minor
---

You can now tag spans and redact sensitive input or output per request by passing `tags`, `hideInput`, or `hideOutput` in `tracingOptions` when calling an agent or workflow.

Added a lightweight trace endpoint (`GET /observability/traces/:traceId/light`) that returns only timeline-relevant span fields, dramatically reducing payload size when rendering trace timelines. Also added a dedicated span endpoint (`GET /observability/traces/:traceId/spans/:spanId`) to fetch full span details on demand.
