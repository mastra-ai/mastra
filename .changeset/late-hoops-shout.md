---
'@mastra/libsql': patch
'@mastra/pg': patch
---

Bounded Knowledge semantic-outbox reads by pushing current visibility into the SQL query instead of scanning candidate rows client-side.
