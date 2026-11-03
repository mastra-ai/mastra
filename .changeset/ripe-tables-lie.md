---
'@mastra/core': patch
---

Fixed durable agent runs leaking engine state to tools, processors and run details. The span pair a resumed or recovered durable agent run carries to its workers is never visible to a tool or a processor through its request context, and `getWorkflowRunById` with the `requestContext` field leaves out reserved `mastra__` keys, as span serialization already does.
