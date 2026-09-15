---
'@mastra/libsql': patch
'@mastra/pg': patch
---

Factory storage updates that hit a unique index now throw the same `UniqueViolationError` as inserts, so callers can tell a lost claim from any other write failure.
