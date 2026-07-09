---
'@mastra/deployer': patch
---

Fixed a false-positive LOCAL_STORAGE_PATH preflight error that flagged storage paths like `file:./data.db` that don't exist in your project. The deploy bundler's local-storage detector now excludes everything under `.mastra/.build/` (deployer-generated intermediate chunks), not just `@mastra__*` shim files. Those chunks can carry JSDoc examples from library code (for example `LibSQLStore({ url: 'file:./data.db' })` from `@mastra/core`), which previously blocked `mastra server deploy` and forced `--skip-preflight` even though the user's code had no local storage paths. Local storage paths in your own source files are still detected.
