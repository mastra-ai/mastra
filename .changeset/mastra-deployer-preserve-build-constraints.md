---
'@mastra/deployer': patch
---

Fixed `mastra build` so the generated output keeps the dependency version ranges declared in your app's `package.json`, instead of pinning whatever version happened to be installed. An app that depends on `zod: ^4.3.6` next to a hoisted `zod@3.25.76` now gets `^4.3.6` in `.mastra/output/package.json`, so the isolated install resolves the version the app asked for. A package pinned through `overrides`, `resolutions`, `pnpm.overrides` or `pnpm-workspace.yaml` keeps its resolved version, since that version was chosen deliberately. Specifiers the output directory cannot resolve, such as `catalog:`, `workspace:`, `file:`, `link:` and git URLs, keep using the resolved version too.
