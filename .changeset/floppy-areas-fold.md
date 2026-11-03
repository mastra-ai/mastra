---
'@mastra/deployer': patch
---

Fixed `mastra build` installing different dependency versions than your pnpm project resolves. The build output now uses the same `overrides` as your project's lockfile, whether you declare them in `pnpm-workspace.yaml` or in the `pnpm` field of `package.json` on pnpm 10. `packageExtensions` and `ignoredOptionalDependencies` are copied too. On pnpm 10, build approvals such as `onlyBuiltDependencies` in the `pnpm` field of `package.json` are also copied when `packageManager` names pnpm 10. Entries that point to a local path or a workspace package can't be installed from the build output, so the build skips them with a warning. Fixes [#29192](https://github.com/mastra-ai/mastra/issues/29192).

Also fixed `mastra build` failing with `Source contains multiple documents` in monorepos that pack workspace packages. This happened when `packageManager` is set and pnpm 11 or later starts `pnpm-lock.yaml` with an environment document.

Settings in `pnpm-workspace.yaml` written with quoted keys, such as `"allowBuilds":`, are now copied to the build output. Lines the build does not copy, such as a registry auth token, are no longer copied along with the setting above them.
