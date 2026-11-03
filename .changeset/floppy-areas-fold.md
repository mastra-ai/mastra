---
'@mastra/deployer': patch
---

Fixed `mastra build` installing different dependency versions than your pnpm project resolves. The build output now uses the same `overrides` as your project's lockfile, whether you declare them in `pnpm-workspace.yaml` or in the `pnpm` field of `package.json` on pnpm 10. `packageExtensions` and `ignoredOptionalDependencies` from `pnpm-workspace.yaml` are copied too. Entries that point to a local path or a workspace package can't be installed from the build output, so the build skips them with a warning. Fixes [#29192](https://github.com/mastra-ai/mastra/issues/29192).
