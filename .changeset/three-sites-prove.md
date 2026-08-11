---
'mastra': patch
---

Fixed `mastra deploy` (and `mastra studio deploy` / `mastra server deploy`) leaving `.npmrc` out of the uploaded build artifact. `mastra build` copies your project's `.npmrc` into `.mastra/output` so private registries work, but the deploy archive skipped dotfiles — so remote builds installed dependencies without registry credentials and failed with 401 errors for packages from private npm registries. The `.npmrc` now ships with the artifact. Fixes [#21237](https://github.com/mastra-ai/mastra/issues/21237).
