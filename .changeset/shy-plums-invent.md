---
'@mastra/factory': patch
---

`resolveUiDistDir()` now falls back to `node_modules/mastra/dist/factory/` (resolved via `createRequire`) when the SPA isn't found in the usual locations. This lets the Factory SPA middleware mount from the published `mastra` CLI package when it's on the module path, which supports deploy targets that strip the bundled `factory/` assets from the artifact (e.g. Mastra Cloud, where edge-router serves the SPA from R2 upstream of the container).
