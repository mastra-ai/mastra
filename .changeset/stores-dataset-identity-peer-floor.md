---
'@mastra/libsql': patch
'@mastra/mongodb': patch
'@mastra/mysql': patch
'@mastra/pg': patch
'@mastra/spanner': patch
---

Raised the `@mastra/core` peer dependency floor to `>=1.51.0-0` so the dataset item identity helpers used by the storage adapters are available at runtime.
