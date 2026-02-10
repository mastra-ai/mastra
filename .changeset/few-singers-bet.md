---
'@mastra/pg': patch
---

Fixed cross-schema constraint checks in multi-schema PostgreSQL setups so tables and indexes are created in the intended schema. Single-schema (default) setups are unaffected.
