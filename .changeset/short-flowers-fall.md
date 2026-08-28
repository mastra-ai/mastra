---
'@mastra/client-js': patch
'@mastra/server': patch
'@mastra/mongodb': patch
'@mastra/spanner': patch
'@mastra/core': patch
'@mastra/libsql': patch
'@mastra/mysql': patch
'@mastra/pg': patch
---

Add permanent dataset item purging that scrubs SCD-2 history rows, tombstones, and linked experiment result payloads while preserving version and review metadata.
