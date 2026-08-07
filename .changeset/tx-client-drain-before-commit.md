---
'@mastra/pg': patch
'@mastra/dsql': patch
---

Fixed transaction completion when applications start several database operations at the same time. Pending operations now finish before the transaction completes or is cancelled, preventing query conflicts after batch failures and operations that application code does not await.
