---
'@mastra/pg': patch
'@mastra/dsql': patch
---

Discard PostgreSQL pool connections when starting or rolling back a transaction fails, preventing an unknown transaction state from leaking into the next checkout. Preserve the original transaction error and report rollback failures through the configured logger.
