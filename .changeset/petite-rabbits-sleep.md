---
'@mastra/libsql': patch
'@mastra/pg': patch
'@mastra/mysql': patch
---

**Fixed:** `mastra build` output no longer deadlocks during storage initialization for apps using `LibSQLStore`, `PostgresStore`, or `MySQLStore` with observational memory enabled. The memory stores used to load the observational-memory table schema via `await import('@mastra/core/storage')` from inside `MemoryStorage.init()`. Bundlers rewrote that dynamic import to point at the entry chunk that statically imports the same file, so when storage initialized during module evaluation the cycle never resolved and the process hung silently after the API server logged "Mastra API running".

The peerDependency on `@mastra/core` is already `>=1.42.1` — the version that introduced `OBSERVATIONAL_MEMORY_TABLE_SCHEMA` — so the older-core fallback the dynamic import was guarding against can no longer occur via npm resolution. Switched to a static import in `libsql` and `mysql`; reused the existing top-of-file `createRequire`-shimmed `_omTableSchema` in `pg`. No public API change.

Reported in mastra-ai/mastra#18298 (`mastra dev` worked, `mastra start` after `mastra build` hung on first storage-touching request). The `bundler.externals` workaround the reporter shipped is no longer needed.
