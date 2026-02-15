---
'@mastra/deployer': patch
---

Fixed monorepo tsconfig path alias resolution in dev mode. When path aliases (e.g., `@lib/*`) point to files in a different workspace package, their transitive dependencies are now correctly resolved at runtime. Previously, `mastra dev` would fail with `Cannot find package` errors for dependencies only installed in the aliased package's `node_modules`. Fixes #12550.
