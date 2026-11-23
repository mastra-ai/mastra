---
'@mastra/server': patch
---

Agents that run on a durable or evented execution engine (`durable.executionEngine`) now work with the same run routes as `createDurableAgent()` agents:

- Tool approval and resume routes apply the same run ownership checks, so a request can no longer resume or approve a suspended run that belongs to another resource or thread.
- `POST /agents/:agentId/runs/:runId/abort` stops their runs instead of returning 404.
- `POST /agents/:agentId/recover` recovers their runs instead of returning 400.
