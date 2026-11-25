---
'@mastra/core': patch
---

Knowledge change listeners (`knowledge.onChange()`, and Studio's live Knowledge view) now hear about pages an importer run creates, updates, moves or removes. Writes made in a `getStorage().transaction()` are reported once the transaction commits, and not at all if it rolls back.

The store handed to a `getStorage().transaction()` callback is now a wrapper, so passing it to `pgKnowledgeTransactionClient()` or `libsqlKnowledgeTransaction()` throws. Make those calls in a service host's `admit(tx)`, which still gets the store's own transaction:

```ts
// Before: now throws
const storage = await knowledge.getStorage();
await storage.transaction(async tx => {
  await pgKnowledgeTransactionClient(tx).none('INSERT INTO claims (claim) VALUES ($1)', [claimId]);
});

// After: write the claim in the run's start transaction
const host = createKnowledgeImporterHost(knowledge, { bindings });
await host.startRun('tickets', {
  admit: async tx => {
    await pgKnowledgeTransactionClient(tx).none('INSERT INTO claims (claim) VALUES ($1)', [claimId]);
  },
});
```
