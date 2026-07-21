---
'@mastra/deployer': patch
---

Fix `mastra build`/`mastra dev` crashing with `Missing "." specifier in "<pkg>" package` for monorepos that contain workspace packages declaring only subpath exports (no `.` entry), when building with `bundler.externals: true` (or in dev). The transitive-dependency walk no longer fabricates a synthetic root `export * from '<pkg>'` for a workspace package that cannot be imported at its root; the subpaths that are actually imported are unaffected. The `resolve.exports` lookup for a root specifier is now guarded so it falls back to `main`/`index` instead of throwing. Purely additive: builds that already succeed are unchanged.
