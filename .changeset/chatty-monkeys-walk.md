---
'@mastra/core': minor
---

Added the `agentSignals` storage domain for storage adapter authors. `AgentSignalsStorage` is the base class to implement, and `InMemoryAgentSignalsStorage` is the in-memory implementation that `InMemoryStore` includes. Stores that do not implement the domain return `undefined` from `getStore('agentSignals')`.

```ts
const agentSignals = await storage.getStore('agentSignals');
if (agentSignals) {
  const pending = await agentSignals.listPending({ threadKey });
}
```
