---
'@mastra/inngest': patch
---

Fixed `POST /agents/:agentId/runs/:runId/abort` answering `{ aborted: false }` for in-flight `createInngestAgent` runs. The route can now find, authorize, and stop a running Inngest run mid-tool, the same as durable agents. Callers who don't own the run are still rejected.
