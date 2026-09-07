---
'@mastra/mssql': minor
---

Add Observational Memory support to @mastra/mssql storage adapter. The `mastra_observational_memory` table is now created during initialization and all OM methods (get, initialize, update, buffer management, reflection generation) are implemented using T-SQL syntax with proper parameter binding and pagination.
