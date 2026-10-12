---
'@mastra/server-adapters-test-suite': patch
'@mastra/client-js': patch
'@mastra/factory': patch
'@mastra/clickhouse': patch
'@mastra/cloudflare': patch
'@mastra/memory': patch
'@mastra/server': patch
'@mastra/code-sdk': patch
'mastracode': patch
'@mastra/mongodb': patch
'@mastra/core': patch
'@mastra/libsql': patch
'mastra': patch
'@mastra/mysql': patch
'@mastra/pg': patch
---

Prevent Knowledge startup from deleting populated legacy LibSQL layouts and restore the published storage contract version.
