---
'@mastra/server': minor
'@mastra/client-js': minor
---

Added `listBranches` and `getBranch` endpoints. Use these to find specific runs of an agent, workflow, tool, or processor — even when they are nested inside another trace — and to fetch the subtree of spans rooted at any single span.

```
GET /observability/branches?spanType=agent_run&entityName=Observer
GET /observability/traces/:traceId/branches/:spanId?depth=1
```

Each row in `listBranches` is a single anchor span (one of `AGENT_RUN`, `WORKFLOW_RUN`, `PROCESSOR_RUN`, `SCORER_RUN`, `RAG_INGESTION`, `TOOL_CALL`, `MCP_TOOL_CALL`), so entities that always run as a child (e.g., an `Observer` agent inside a workflow) — previously not listable through `listTraces` — are now queryable via the HTTP API. `getBranch` accepts an optional `depth` (`0` = anchor only; omitted = full subtree).

Follow-up to https://github.com/mastra-ai/mastra/pull/16154 which added the underlying `@mastra/core` storage APIs.
