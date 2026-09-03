---
'@mastra/duckdb': patch
---

Fixed `@mastra/duckdb` breaking Vite-based dev servers such as TanStack Start. Vite's dependency optimizer followed the static import of `@duckdb/node-api` into its platform-specific `.node` binaries and failed with `[UNLOADABLE_DEPENDENCY] Could not load ... duckdb.node`. The native module is now loaded at runtime with `createRequire`, which bundlers do not trace, so no `optimizeDeps.exclude` or Nitro `external` workaround is needed.
