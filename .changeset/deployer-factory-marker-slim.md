---
'@mastra/deployer': patch
---

`writeFactoryMarker()` no longer checks that `.mastra/output/factory/index.html` exists, and the marker (`mastra-project.json`) no longer advertises an `assets.ui` path. Some deploy targets (e.g. `@mastra/deployer-cloud`) strip the bundled Factory SPA from the artifact because upstream infrastructure serves it, so the marker can't require the SPA to be present.
