---
'@mastra/deployer': patch
---

Fixed `mastra build` failing with `Missing "." specifier` when a workspace package declares only subpath exports.

In a monorepo, a build using `bundler: { externals: true }` crashed during analysis if any transitive workspace dependency declared an `exports` map with no `"."` entry — a common convention for internal utility packages:

```jsonc
// packages/leaf/package.json
{
  "name": "@scope/leaf",
  "exports": {
    "./sub/*": "./src/*.ts"
  }
}
```

The build failed with `Failed to analyze: Missing "." specifier in "@scope/leaf" package` even though no code imported the package root.

The transitive workspace walk was registering every workspace dependency as a root-level import, including packages only ever used through a subpath. The subpaths that are actually imported were already tracked separately, so the redundant root entry is now skipped for packages that have no root export. Internal packages can keep subpath-only exports maps as they are, instead of needing stub `"."` entries pointing at empty files.
