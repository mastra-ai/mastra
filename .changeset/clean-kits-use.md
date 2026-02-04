---
'@mastra/deployer': patch
---

Fixed bundling of workspace packages in monorepo setups.

**What was fixed:**

- Workspace packages with hyphens in their names (e.g., `@scope/my-tools`) are now correctly identified during bundling
- TypeScript files in workspace packages are now properly transpiled when resolved through pnpm's `node_modules` symlinks
- Transitive workspace dependencies (e.g., `@inner/lodash` imported by `@inner/inner-tools`) are now correctly discovered and bundled

**Why this happened:**

The bundler used `-` as a path separator in generated filenames, which conflicted with hyphens in package names. Additionally, the esbuild plugin's default `/node_modules/` exclusion pattern was preventing workspace package files from being transpiled when resolved through pnpm symlinks. Transitive dependency discovery also failed when the entry file was a virtual module.
