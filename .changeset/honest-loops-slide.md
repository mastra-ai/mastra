---
'@mastra/inngest': patch
---

Fixed `serve()` and `connect()` registering zero functions for agents wrapped with `createInngestAgent()` on `@mastra/core` 1.65.0 and newer. Mastra hides each durable agent's backing loop workflow from `listWorkflows()`, so Inngest never received it and durable runs never started. The loop workflow is now collected from the registered agents as well. Fixes [#23871](https://github.com/mastra-ai/mastra/issues/23871).
