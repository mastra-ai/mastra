---
'@mastra/mongodb': patch
'@mastra/spanner': patch
'@mastra/libsql': patch
'@mastra/mysql': patch
'@mastra/pg': patch
---

Fixed dataset item writes so purged payloads cannot be restored during concurrent updates or deletes.
