---
'@mastra/core': patch
---

Add `agent.streamUntilIdle()` and default sub-agents to run as background tasks.

**`streamUntilIdle`**

A new agent streaming method that keeps the stream open until all background tasks dispatched during the turn complete. When a task finishes, the agent is re-invoked automatically so the result is processed in the same call — no second user turn required.

```ts
// Before — stream closes once the LLM returns. Background task
// results are only processed on the next user message.
const result = await agent.stream('Research quantum computing', { memory });
for await (const chunk of result.fullStream) {
  /* ... */
}

// After — stream stays open through the background task completion
// and the follow-up agent turn; the final answer arrives in the same call.
const result = await agent.streamUntilIdle('Research quantum computing', { memory });
for await (const chunk of result.fullStream) {
  /* ... */
}
```
