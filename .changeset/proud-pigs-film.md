---
'@mastra/core': patch
'@mastra/server': patch
---

Fixed tool approvals for Inngest durable agents ([#25154](https://github.com/mastra-ai/mastra/issues/25154)).

- Runs created with `createInngestAgent()` that wait on tool approval now appear in `GET /api/agents/:agentId/suspended-runs` and `agent.listSuspendedRuns()`.
- `approve-tool-call` and `decline-tool-call` now accept these runs. They no longer return "Access denied: durable run belongs to a different resource".
- Durable runs waiting on an approval-gated tool now report `requiresApproval: true` and the tool's `args`.
