---
'@mastra/inngest': patch
---

Honor `toolCallConcurrency` on the Inngest durable engine. `createInngestDurableAgenticWorkflow` called `.foreach(toolCallStep)` without a concurrency option, so parallel tool calls always ran sequentially regardless of `toolCallConcurrency`. Concurrency is now resolved per iteration (default 10, forced to 1 when the run requires tool approval or a called tool can suspend / requires approval) and passed to the tool-call foreach — matching `@mastra/core`. Fixes #19317.
