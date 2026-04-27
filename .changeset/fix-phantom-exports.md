---
'@mastra/core': patch
---

Block 50 phantom subpath exports with `null` entries in package.json. The wildcard `./*` export combined with tsc emitting individual `.d.ts` files created importable subpaths (e.g. `@mastra/core/auth/ee/defaults`) that compiled in TypeScript but crashed at runtime with `MODULE_NOT_FOUND`. Null exports cause clear errors at both compile time (`TS2307`) and runtime (`ERR_PACKAGE_PATH_NOT_EXPORTED`). Subpaths used for type-only imports by other workspace packages are left unblocked.
