---
'@mastra/core': patch
'@mastra/libsql': patch
'@mastra/pg': patch
'@mastra/mysql': patch
'@mastra/mongodb': patch
---

Knowledge records in host-configured companion scopes are now resolved consistently, and search results redact parent identity when the record is visible but its node is not. Companion scopes are never created automatically; declare one under `scopes` in your `Knowledge` config when you want provisional placement.
