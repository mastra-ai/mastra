---
'@mastra/connect': minor
'@mastra/mcp-docs-server': patch
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

Added a 'scopes' option to knowledge importer integrations: pass a function returning scope addresses (for example one per active project) and the importer syncs into that live set on every run, alongside any static scopes from the access map.
