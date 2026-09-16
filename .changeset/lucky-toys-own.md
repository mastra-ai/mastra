---
'@mastra/deployer': patch
---

Fixed builds that use dependency subpath imports when the package exposes a nested module package.json. Fixes #12535.
