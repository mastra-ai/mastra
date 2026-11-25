---
'@mastra/pg': minor
---

Added `AgentSignalsPG`, the PostgreSQL implementation of the `agentSignals` storage domain. `PostgresStore` now provides it through `storage.getStore('agentSignals')`, and `init()` creates its `mastra_agent_signals` and `mastra_agent_signal_runs` tables in the store's schema. `exportSchemas()` includes both tables and their indexes.

```ts
const storage = new PostgresStore({ id: 'my-store', connectionString: process.env.DATABASE_URL });
const agentSignals = await storage.getStore('agentSignals');
```
