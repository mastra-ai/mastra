---
'@mastra/server': patch
'@mastra/libsql': patch
'@mastra/mongodb': patch
'@mastra/mysql': patch
'@mastra/pg': patch
'@mastra/spanner': patch
---

Raised the `@mastra/core` peer dependency floor to `>=1.51.0-0` so dataset item identity behavior is available to the server and storage adapters at runtime.
