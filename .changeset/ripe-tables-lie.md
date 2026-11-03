---
'@mastra/core': patch
---

Fixed durable agent runs leaking engine state to tools and run details. A tool run by a resumed or recovered durable agent no longer sees the engine's execution claim or span carrier in its request context, and `getWorkflowRunById` with the `requestContext` field leaves out reserved `mastra__` keys, as span serialization already does.
