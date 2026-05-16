---
'@mastra/deployer': patch
---

Fixed `mastra build` failing on pnpm v11 with `ERR_PNPM_IGNORED_BUILDS` when the project depends on a package with postinstall scripts (e.g. `better-sqlite3`). The deployer no longer writes `pnpm: { neverBuiltDependencies: [] }` to the output `package.json` — that key silently bypassed the user's pnpm build allow/deny list on v10 and was no longer honored on v11. Instead, the install path writes a local `pnpm-workspace.yaml` next to the output `package.json` so pnpm finds it before traversing up to the user's parent workspace, replacing the previous `--ignore-workspace` flag (which v11 no longer honors the same way). Addresses [#16613](https://github.com/mastra-ai/mastra/issues/16613).

If your project allows specific package build scripts (`better-sqlite3`, native bindings, etc.) via your own `pnpm-workspace.yaml > allowBuilds`, that configuration is currently NOT carried over into the deployer output — pnpm runs its default policy there. Carrying over the user's `allowBuilds` / `onlyBuiltDependencies` is a separate follow-up; for now, run `pnpm config set allowBuilds <pkg>` (or equivalent) inside `.mastra/output` if you need to opt build scripts back in.
