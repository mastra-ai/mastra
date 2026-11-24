---
'@mastra/pg': minor
---

Added `pgKnowledgeTransactionClient(tx)` (experimental). It returns the PostgreSQL transaction behind a Knowledge transaction view, so a host can write its own rows in the same transaction as Knowledge's. For example, an importer service host's `admit(tx)` can record its claim on the run it starts: the claim commits with the run, and rolls back with it when admission is refused or the start is skipped.

```ts
import { pgKnowledgeTransactionClient } from '@mastra/pg';

await host.startRun(bindingId, {
  admit: async tx => {
    await pgKnowledgeTransactionClient(tx).none('UPDATE my_claims SET claimed = true WHERE id = $1', [claimId]);
  },
});
```
