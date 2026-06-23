---
"@mastra/ai-sdk": patch
---

`workflowRoute` now uses `MASTRA_RESOURCE_ID_KEY` from `requestContext` (set by server middleware) as the `resourceId` when creating a workflow run, falling back to the client-supplied value. This matches the precedence contract already enforced in agent calls.
