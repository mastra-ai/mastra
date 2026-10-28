---
'@mastra/libsql': patch
'@mastra/pg': patch
'@mastra/mysql': patch
'@mastra/mssql': patch
'@mastra/dsql': patch
'@mastra/cloudflare-d1': patch
---

Fixed workflow runs canceled from another process being overwritten by a concurrent snapshot write. The store now checks the run status in the same statement as the write. Cancellation checks now read only the stored run status instead of the whole snapshot.
