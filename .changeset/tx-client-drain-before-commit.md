---
'@mastra/pg': patch
'@mastra/dsql': patch
---

Drain TransactionClient query queue before COMMIT/ROLLBACK so batch failure and fire-and-forget paths cannot race the control statements on one PoolClient.
