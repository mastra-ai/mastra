---
'@mastra/core': patch
'@mastra/libsql': patch
'@mastra/pg': patch
'@mastra/mysql': patch
'@mastra/mongodb': patch
---

Knowledge records in host-configured companion scopes are now resolved consistently, existing scopes can gain newly declared parents and grants, and search results redact parent identity when the record is visible but its node is not. Companion scopes are never created automatically; declare one under `scopeTypes` when you want provisional placement.
