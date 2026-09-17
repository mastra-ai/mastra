---
'@mastra/libsql': patch
'@mastra/pg': patch
---

Fixed unique-index update errors in the Factory storage adapters. Updates now throw `UniqueViolationError`, the same error inserts already threw, so callers can handle a duplicate claim consistently.
