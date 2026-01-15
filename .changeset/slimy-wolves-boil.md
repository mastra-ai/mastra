---
'@mastra/pg': patch
---

Fixed PostgreSQL storage issues after JSONB migration.

**Bug Fixes**

- Fixed `clearTable()` using incorrect default schema. The method was checking for table existence in the 'mastra' schema instead of PostgreSQL's default 'public' schema, causing table truncation to be skipped and leading to duplicate key violations in tests and production code that uses `dangerouslyClearAll()`.
- Fixed `listWorkflowRuns()` status filter failing with "function regexp_replace(jsonb, ...) does not exist" error. After the TEXT to JSONB migration, the query tried to use `regexp_replace()` directly on a JSONB column. Now casts to text first: `regexp_replace(snapshot::text, ...)`.
- Added Unicode sanitization when persisting workflow snapshots to handle null characters (\u0000) and unpaired surrogates (\uD800-\uDFFF) that PostgreSQL's JSONB type rejects, preventing "unsupported Unicode escape sequence" errors.
