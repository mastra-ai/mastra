---
'@mastra/server': patch
---

Forward `requestContext` from the `/approve-tool-call`, `/decline-tool-call`, `/approve-tool-call-generate` and `/decline-tool-call-generate` REST handlers to `agent.approveToolCall(...)` / `declineToolCall(...)` / `approveToolCallGenerate(...)` / `declineToolCallGenerate(...)`.

Previously `requestContext` was destructured from the handler arguments but never passed through. On resume, `dynamicInstructions` ran with `requestContext: undefined`, so any value placed on the per-request `RequestContext` by upstream middleware (or by `body.requestContext` auto-merge) was lost for the rest of the turn. Agents whose prompt assembly depends on request-scoped data (e.g. read-only state from the frontend) produced blank or placeholder responses after the user approved a HITL tool call. Other agent entry points (`stream`, `generate`) already forwarded `requestContext` correctly; this brings the approval routes in line.
