---
'@mastra/server': minor
'@mastra/client-js': patch
---

Added an asynchronous durable agent run API with status and result lookup.

Start a run with `POST /api/agents/:agentId/runs` and a `{"messages":"Hello"}` body. Use the returned `runId` with `GET /api/agents/:agentId/runs/:runId` to retrieve the final outcome after the stream closes.
