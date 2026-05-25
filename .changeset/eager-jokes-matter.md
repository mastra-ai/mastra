---
'@mastra/core': minor
'@mastra/memory': patch
---

Added `sendDataPart()` for streaming client-visible `data-*` parts to thread subscribers without entering LLM context or waking the agent. Data parts persist as normal assistant message parts: active responses append to the current assistant message, while idle sends create a small assistant message containing the data part. Use `agent.sendDataPart({ type: 'data-...', data: {...} }, { resourceId, threadId })` from the Agent, or `context.sendDataPart({ type: 'data-...', data: {...} })` from within processors.
