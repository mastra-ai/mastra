---
'@mastra/core': patch
---

Fix `MCPServer` construction throwing `(0 , import_slugify.default) is not a function` under CommonJS. `@sindresorhus/slugify` is ESM-only, and the bundler's CJS interop bridge (`__toESM(mod, 1)`) shadows the namespace's own `default` export, so the generated `slugify.default(...)` call was not callable. `slugify` is now resolved through an interop-safe helper shared by `MCPServerBase` and schedule id canonicalization.
