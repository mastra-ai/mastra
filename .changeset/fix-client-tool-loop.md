---
'@mastra/core': patch
---

Fixed an infinite agentic loop when a step ends with `finishReason: 'tool-calls'` and all called tools are client-only.

Previously, Mastra could call the model again without any new tool result, which repeated the same tool calls until `maxSteps`.

Now, Mastra only continues when at least one called tool can run on the server or when a provider-executed tool result requires another model turn.
