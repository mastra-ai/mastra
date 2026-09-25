---
'@mastra/core': patch
'@mastra/server': patch
---

Fixed tool approvals for Inngest durable agents. Runs created with `createInngestAgent()` that are waiting on tool approval now show up in `GET /api/agents/:agentId/suspended-runs` and `agent.listSuspendedRuns()`, and `approve-tool-call` / `decline-tool-call` no longer reject them with "Access denied: durable run belongs to a different resource". Fixes #25154.
