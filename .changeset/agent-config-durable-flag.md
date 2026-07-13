---
'@mastra/core': patch
---

Added a `durable` field to `AgentConfig` so an agent can opt into durable execution without a separate `createDurableAgent` call. Setting `durable: true` (or `durable: { cache, pubsub, maxSteps, cleanupTimeoutMs }`) auto-wraps the agent with `createDurableAgent` when it is attached to a `Mastra` instance; the factory function remains available for advanced use.

```ts
const agent = new Agent({
  id: 'my-agent',
  name: 'My Agent',
  instructions: 'You are a helpful assistant',
  model,
  durable: true, // or: { maxSteps: 10, cleanupTimeoutMs: 60_000 }
});

export const mastra = new Mastra({ agents: { agent } });
```
