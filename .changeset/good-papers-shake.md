---
'@mastra/mongodb': patch
'@mastra/spanner': patch
'@mastra/core': patch
'@mastra/libsql': patch
'@mastra/mssql': patch
'@mastra/mysql': patch
'@mastra/pg': patch
---

Fixed schedules of dynamically created workflows disappearing after a restart. Their schedule configuration is now persisted and restored, so the Schedules tab in Studio keeps showing them and they continue to run.
