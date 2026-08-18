---
'@mastra/core': patch
---

Fixed `DurableAgent.listActiveRuns()` and `recoverActiveRuns()` loading every running run's full workflow snapshot into memory at once. Candidate runs are now fetched from storage in bounded batches of 100 rows, so discovering or recovering runs against a large backlog no longer risks exhausting process memory. Fixes [#21501](https://github.com/mastra-ai/mastra/issues/21501).
