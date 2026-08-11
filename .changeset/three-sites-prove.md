---
'mastra': patch
---

Fixed `mastra deploy` (and `mastra studio deploy` / `mastra server deploy`) leaving `.npmrc` out of the uploaded artifact, which made installs of packages from private npm registries fail with 401 errors during remote builds. The `.npmrc` now ships with the artifact. Fixes [#21237](https://github.com/mastra-ai/mastra/issues/21237).
