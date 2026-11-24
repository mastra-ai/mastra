---
'@mastra/core': minor
---

Added the `agentSignals` storage domain for storage adapter authors. `AgentSignalsStorage` is the base class to implement, and `InMemoryAgentSignalsStorage` is the in-memory implementation that `InMemoryStore` includes. Stores that do not implement the domain return `undefined` from `getStore('agentSignals')`. The domain's table names and schemas (`TABLE_AGENT_SIGNALS`, `TABLE_AGENT_SIGNAL_RUNS`, `AGENT_SIGNALS_TABLE_CONFIGS`) are exported from `@mastra/core/storage` for adapters.

```ts
const agentSignals = await storage.getStore('agentSignals');
if (agentSignals) {
  const pending = await agentSignals.listPending({ threadKey });
}
```
