---
'create-factory': patch
---

Changed the create-factory template sync to pin every Mastra dep to `"latest"` instead of `"alpha"`. Scaffolded projects now install the same set of Mastra packages as every other create-mastra template, and no longer ship a `.npmrc` with `legacy-peer-deps=true` (that flag only existed to accommodate the prerelease peer graph).
