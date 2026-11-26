---
'@mastra/libsql': patch
'@mastra/pg': patch
---

Run ownership records now include `updatedAt`, so a workflow run restarted after its lease lapsed gets a longer lease on these stores.
