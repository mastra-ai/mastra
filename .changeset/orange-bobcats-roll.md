---
'@mastra/core': patch
'@mastra/libsql': patch
'@mastra/pg': patch
'@mastra/mysql': patch
'@mastra/mongodb': patch
---

Added built-in uncurated companion scope templates for Knowledge capture. Companion-scoped records are now resolved consistently, existing scopes can gain newly declared parents and grants, and search results redact parent identity when the record is visible but its node is not.
