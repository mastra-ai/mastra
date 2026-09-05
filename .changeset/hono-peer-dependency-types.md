---
'@mastra/core': patch
---

Stop vendoring Hono declaration files into `dist/_types/` and declare `hono` / `hono-openapi` as peer dependencies, so consumer typechecks see a single Hono type identity under `moduleResolution: "bundler"`
