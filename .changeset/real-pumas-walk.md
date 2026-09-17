---
'@mastra/deployer': patch
---

Fixed builds with externals so workspace subpath imports used by other workspace packages are compiled instead of failing at runtime. Fixes #22851.
