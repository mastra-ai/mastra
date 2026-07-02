---
'@mastra/deployer': patch
---

Fixed `mastra build` and `mastra dev` dropping transitive workspace packages from the output bundle.

When a workspace package depended on another workspace package that your Mastra app did not import directly (e.g. app → `@repo/a` → `@repo/b` → `@repo/c`), the deepest packages were left out of the build. The build succeeded but the server crashed at runtime with `ERR_MODULE_NOT_FOUND`. It worked in `mastra dev` only because the missing package was still resolvable through the pnpm `node_modules` symlinks.

The dependency analyzer now walks the full workspace dependency graph instead of stopping one level deep, and resolves each transitive workspace package relative to the package that imports it (so it works with strict pnpm layouts).
