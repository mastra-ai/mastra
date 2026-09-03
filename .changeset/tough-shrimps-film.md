---
'@mastra/duckdb': patch
---

Fixed `@mastra/duckdb` breaking Vite-based dev servers such as TanStack Start. Vite's client dependency optimizer followed the static import of `@duckdb/node-api` into its platform-specific `.node` binaries and failed with `[UNLOADABLE_DEPENDENCY] Could not load ... duckdb.node`. The package now ships a `browser` export condition that resolves to a stub whose exports throw when used, so client-side bundlers never trace into the native bindings. Node.js resolution (including `mastra build`) is unchanged and keeps the static `@duckdb/node-api` import.
