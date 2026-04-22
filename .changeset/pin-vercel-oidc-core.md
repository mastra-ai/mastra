---
'@mastra/core': patch
---

fix(deps): pin @vercel/oidc to 3.1.0 in @mastra/core

@vercel/oidc 3.2.0 ships a build that breaks when bundled as ESM from CJS
(emits `__require("path")` stubs that throw "Dynamic require of path is not
supported" at runtime). Declaring @vercel/oidc as a direct, exact-version
dependency of @mastra/core forces downstream installs to resolve 3.1.0,
unblocking E2E and consumer projects.
