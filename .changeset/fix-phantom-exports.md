---
'@mastra/core': patch
---

Replace wildcard `./*` export with an explicit allowlist of 48 valid subpath exports. The wildcard combined with tsc emitting individual `.d.ts` files created phantom subpaths (e.g. `@mastra/core/auth/ee/defaults`) that compiled in TypeScript but crashed at runtime with `MODULE_NOT_FOUND`. The allowlist approach only exposes subpaths that have actual runtime JS, preventing phantom imports entirely.
