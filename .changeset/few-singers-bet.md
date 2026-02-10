---
'@mastra/pg': patch
---

Fixed pg_constraint queries to filter by schema namespace, preventing false matches across schemas in multi-schema setups. Single-schema (default) setups are unaffected.
