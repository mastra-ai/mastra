---
'@mastra/deployer': patch
'@mastra/cli': patch
---

Fix `mastra dev` failing with Prisma due to CJS/ESM interop issues.

**What was fixed:**

- DevBundler now forwards user `bundler.externals` config to the dev watcher, so users can control which packages are externalized in dev mode
- The `commonjs` Rollup plugin is no longer disabled when `externalsPreset` is true — it now emits safe namespace imports instead of broken default imports for ESM packages
- Added `@prisma/client` to `GLOBAL_EXTERNALS` alongside `pg`, `pino`, and other commonly externalized packages

**Why this happened:**

The dev bundler read the user's bundler config but only forwarded `sourcemap`, silently ignoring `externals`. The watcher defaulted to externalizing all deps while also disabling the `commonjs` plugin, which meant any CJS `require()` calls in bundled workspace code got transformed to `import x from '...'` (default import). At runtime this fails for ESM packages like `@prisma/client-runtime-utils` that have no default export.
