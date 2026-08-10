---
'@mastra/core': patch
---

Fix durable agents dropping `requestContext` when a step is rehydrated on another process (for example an Inngest worker delegating to a subagent). Tool, memory, and workspace resolution now fall back to the run-level request context when the step input carries no request-context snapshot, so request-scoped configuration reaches subagents instead of resolving with an empty context.
