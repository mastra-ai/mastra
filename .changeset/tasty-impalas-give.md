---
'mastra': patch
---

Fixed `mastra dev` and `mastra build` crashing with `Invalid comparator: workspace:^` when an installed Mastra package declares its peer dependencies with a non-semver range like `workspace:^` (for example when packages resolve to monorepo source via pnpm workspaces). The peer dependency check now skips ranges it cannot compare instead of throwing.
