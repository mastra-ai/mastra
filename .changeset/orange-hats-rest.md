---
'@mastra/inngest': patch
'@mastra/core': patch
---

Durable agents (`createDurableAgent`, `createEventedAgent`, `createInngestAgent`) now record more trace data. The model generation span shows the prompt, model settings and tools, the agent run span shows the available tools, both show the structured output object, and an input processor abort shows on the run span. The agent's `tracingPolicy` now hides durable model spans, and evented workers now trace output processors, memory saves and title generation.
