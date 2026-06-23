---
'@mastra/libsql': patch
'@mastra/pg': patch
'@mastra/mysql': patch
---

Fixed: `mastra build` output no longer hangs on the first storage-touching request when an app uses `LibSQLStore`, `PostgresStore`, or `MySQLStore` with observational memory. `mastra dev` was unaffected; only the bundled `mastra start` output deadlocked. No code changes or `bundler.externals` workaround required on the app side after upgrading.
