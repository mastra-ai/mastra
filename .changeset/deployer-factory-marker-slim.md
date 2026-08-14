---
'@mastra/deployer': patch
---

`writeFactoryMarker()` no longer checks that `.mastra/output/public/factory/index.html` exists, and the marker (`mastra-project.json`) no longer advertises an `assets.ui` path. The Factory SPA is now resolved at runtime from `node_modules/mastra/dist/factory/` by `@mastra/factory` rather than bundled into the deploy artifact.
