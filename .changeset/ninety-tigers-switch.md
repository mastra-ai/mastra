---
'@mastra/core': patch
'@mastra/libsql': patch
'mastra': patch
'@mastra/pg': patch
---

The dev and build server now register the internal durable scoring workflow so live scorer executions get durable run records with retry.

No configuration is needed — any agent with scorers and storage configured gets durable scoring runs when served via `mastra dev` or `mastra build`:

```typescript
export const mastra = new Mastra({
  agents: { myAgent }, // agent with `scorers` configured
  storage: new LibSQLStore({ url: 'file:./mastra.db' }),
});
```
