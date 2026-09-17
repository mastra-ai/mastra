---
"@mastra/core": minor
---

Add `idleTimeoutMs` passthrough from `stream()` and `generate()` methods to `createDurableAgentStream()`, enabling auto-termination for crashed producers. This matches the behavior in `observe()` and prevents streams from hanging indefinitely when the producing process crashes.

```ts
// DurableAgent.stream() and DurableAgent.generate() now accept idleTimeoutMs
const agent = new DurableAgent({ name: 'MyAgent', model });
const stream = await agent.stream('Hello', { idleTimeoutMs: 30000 });
```
