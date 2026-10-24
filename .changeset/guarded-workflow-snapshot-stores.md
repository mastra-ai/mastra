---
'@mastra/libsql': patch
'@mastra/pg': patch
'@mastra/mysql': patch
'@mastra/mssql': patch
'@mastra/dsql': patch
'@mastra/cloudflare-d1': patch
---

Workflow snapshot writes now check the run status in the same statement as the write, so a run canceled from another process stays canceled. Run status checks read only the stored status instead of the whole snapshot.
