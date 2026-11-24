---
'@mastra/core': minor
'@mastra/pg': minor
---

Added an optional deadline to Knowledge storage transactions. `knowledge.storage.transaction(operation, { deadlineAt })` rolls back and throws `KnowledgeTransactionDeadlineError` once the deadline passes. On Postgres (`enforcesTransactionDeadline: true`), the wait for a connection, every statement and every lock wait count against the deadline, and no new work starts once it has passed. BEGIN, ROLLBACK and a COMMIT already sent aren't bounded, so leave a margin. Adapters without the capability ignore the option.

```ts
await storage.transaction(async tx => {
  // writes
}, { deadlineAt: Date.now() + 10_000 });
```
