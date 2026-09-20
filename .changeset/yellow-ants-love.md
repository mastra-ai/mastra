---
'@mastra/deployer': minor
---

Extended pnpm patch preservation to yarn (Berry) and bun. `mastra build` now copies `.yarn/patches/` into the output for yarn workspaces and rewrites bun's `patchedDependencies` from `package.json` into the output bundle with output-relative paths, so deployed apps apply the same patches regardless of package manager.