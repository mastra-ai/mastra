---
'@mastra/factory': patch
---

Fixed the Factory SPA not being served in deployed runtimes that start the artifact from outside the output directory (e.g. `WORKDIR /app` + `node output/index.mjs`). `resolveUiDistDir` now also checks for `factory/` next to the entry script (`process.argv[1]`), so cwd no longer has to be the output directory for the UI to mount.
