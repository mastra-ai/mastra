---
'@mastra/core': minor
'@mastra/server': minor
'@mastra/editor': minor
'@mastra/client-js': minor
'@mastra/mongodb': patch
'@mastra/spanner': patch
'@mastra/libsql': patch
'@mastra/mssql': patch
'@mastra/mysql': patch
'@mastra/dsql': patch
'@mastra/pg': patch
---

Added a `durable` option to stored agents so agents created through the Agents API can run with durable execution — no code deployment required.

```typescript
await mastraClient.createStoredAgent({
  id: 'helper',
  name: 'Helper',
  instructions: 'You are a helpful assistant.',
  model: { provider: 'openai', name: 'gpt-5' },
  durable: true,
});
```

Pass `true` for defaults, or `{ maxSteps, cleanupTimeoutMs }` to tune the durable loop. Cache and pubsub are inherited from the server's Mastra instance, so configure distributed backends there for durability across replicas. Automatic recovery is still configured in code via `recovery.durableAgents`.
