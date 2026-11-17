---
'@mastra/mssql': minor
---

Added Observational Memory support to `@mastra/mssql`, so agents can use `observationalMemory: true` with SQL Server storage (#23309). It stays correct when several processes work on the same thread at once: only one record is created per thread or resource, a write to a record that a reflection has already replaced is reported as not applied, and a reflection carries pending tokens and buffered observations over to the new generation. Based on the original work by @PremkumarS-dev in #24374.
