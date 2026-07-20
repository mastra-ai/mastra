---
'@mastra/core': patch
---

Fixed `new Agent({ durable: true })` to actually use the durable execution path when used standalone (without being registered on a `Mastra` instance).

Previously, `durable: true` only took effect when the agent was attached to a `Mastra`. Constructing an agent with `durable: true` and calling `agent.stream(...)` directly silently ran through the non-durable path.

Now `stream`, `generate`, `resumeStream`, `resumeGenerate`, `approveToolCall`, `declineToolCall`, `streamUntilIdle`, `resume`, `recover`, `listActiveRuns`, `recoverActiveRuns`, `observe`, and `prepare` all run through the durable execution path on a standalone `new Agent({ durable: true })`.

```ts
const agent = new Agent({
  id: 'my-agent',
  name: 'My Agent',
  instructions: 'You are a helpful assistant',
  model,
  durable: true,
});

// Now runs through the durable execution path.
await agent.stream('hi');
```
