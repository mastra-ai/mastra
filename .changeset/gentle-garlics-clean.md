---
'@mastra/core': patch
---

Fixed `MastraCompositeStore.init()` silently skipping the parent store's init when constructed with `default` or `editor`. The composite extracted the inner domain instances and initialized them in parallel, never invoking the parent's `init()` — bypassing any connection setup, migrations, DDL ordering, and coalescing of concurrent callers that the adapter relies on.

The loudest symptom was on `LibSQLStore` backed by a local file: skipping its `init()` meant pragmas like `busy_timeout` and `journal_mode=WAL` were never applied, so parallel `CREATE TABLE IF NOT EXISTS` statements raced on the same SQLite file, returned `SQLITE_BUSY`, and left tables like `mastra_schedules` partially created — which the scheduler then tripped over with `no such table`. Other adapters were quietly affected the same way whenever their `init()` did meaningful work.

`MastraCompositeStore.init()` now delegates to the parent `default` and `editor` stores first, then only initializes domains that aren't already covered by a parent. Subclasses that override `init()` (including `LibSQLStore` itself) are unaffected.

Fixes #16782.
