---
'@mastra/deployer': patch
---

Fix two monorepo bundling defects for workspace packages under `bundler.externals: true` (and dev). Purely additive: builds that already succeed are unchanged.

1. Fix `mastra build`/`mastra dev` crashing with `Missing "." specifier in "<pkg>" package` when a workspace package declares only subpath exports (no `.` entry). The transitive-dependency walk no longer fabricates a synthetic root `export * from '<pkg>'` for a package that cannot be imported at its root, and the `resolve.exports` root lookup is guarded so it falls back to `main`/`index` instead of throwing.

2. Fix workspace subpath imports leaking out of the bundle. A subpath imported transitively (by another workspace package, e.g. `@scope/a` importing `@scope/b/sub`) could be emitted as an unresolved bare specifier that is not registered in the generated `package.json`, causing `ERR_MODULE_NOT_FOUND` at runtime. Such subpaths are now resolved to their source and compiled inline.
