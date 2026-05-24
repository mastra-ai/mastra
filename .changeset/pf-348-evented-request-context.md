---
"@mastra/core": patch
---

Fixed `EventedAgent` fire-and-forget workflow runs to forward the caller's `requestContext` into workflow execution.

Runtime workflow steps now receive the same request-scoped context as synchronous durable-agent runs, including tool execution, per-step processors, output processors, scorers, and observability selection.
