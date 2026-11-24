---
'@mastra/libsql': minor
---

Added `AgentSignalsLibSQL`, the LibSQL implementation of the `agentSignals` storage domain. `LibSQLStore` now provides it through `storage.getStore('agentSignals')`, and `init()` creates its `mastra_agent_signals` and `mastra_agent_signal_runs` tables.

```ts
const storage = new LibSQLStore({ id: 'my-store', url: 'file:./mastra.db' });
const agentSignals = await storage.getStore('agentSignals');
```
