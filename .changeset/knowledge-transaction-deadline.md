---
'@mastra/core': minor
'@mastra/pg': minor
---

Added an optional deadline to Knowledge storage transactions. `knowledge.storage.transaction(operation, { deadlineAt })` rolls back and throws `KnowledgeTransactionDeadlineError` once the deadline passes. On Postgres (`enforcesTransactionDeadline: true`), the wait for a connection, every statement and every lock wait count against the deadline, and it's checked again before COMMIT. A COMMIT that has already been sent isn't bounded. Adapters without the capability ignore the option.

```ts
await storage.transaction(async tx => {
  // writes
}, { deadlineAt: Date.now() + 10_000 });
```
