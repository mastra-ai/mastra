---
'@mastra/mongodb': patch
'@mastra/spanner': patch
'@mastra/core': patch
'@mastra/libsql': patch
'@mastra/mssql': patch
'@mastra/mysql': patch
'@mastra/pg': patch
---

Fixed scheduled workflows disappearing from Studio's Schedules tab for dynamically created workflows. Dynamic workflow definitions now persist their schedule configuration, so schedules are re-declared after a restart instead of being deleted as orphans. Schedules of dynamic workflows that fail to load are also kept instead of being swept. Fixes https://github.com/mastra-ai/mastra/issues/22756
