---
'@mastra/libsql': patch
'@mastra/pg': patch
'@mastra/mysql': patch
'@mastra/mongodb': patch
'@mastra/spanner': patch
---

Raise `@mastra/core` peer floor to `>=1.49.0-0` on all storage adapters so the tenancy-related named exports the adapters now consume are guaranteed to exist at install time.
