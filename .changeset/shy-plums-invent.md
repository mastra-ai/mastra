---
'@mastra/factory': patch
'mastra': patch
---

Software Factory projects no longer bundle the Factory SPA into the deploy artifact. `mastra build` used to copy `packages/cli/dist/factory/` into `.mastra/output/public/factory/`, adding ~4 MB to every deploy. The Factory SPA is now resolved at runtime from `node_modules/mastra/dist/factory/` (where the npm `mastra` package already ships it), so the artifact stays small and both CLI-source and GitHub-source deploys produce identical origin bundles. `mastra dev` behavior is unchanged.
