---
'@mastra/core': patch
---

Fixed per-tool `requireApproval` functions (`needsApprovalFn`) receiving no context on durable agents and `agent.network()`. They now get the same `{ requestContext, workspace }` second argument as `stream()`/`generate()`, so approval logic that reads the request context works consistently. On durable agents the request context is restored from the persisted run snapshot when the check runs in another process or after a resume. Fixes #22491
