---
'@mastra/deployer': patch
---

Fixed `mastra build` needing registry credentials to install the build output in pnpm monorepos where the Mastra app is not at the workspace root. When the build packed workspace packages, it edited the copied lockfile for every workspace package. pnpm 11 then rechecked the whole lockfile against your registries during the output install, which failed with `ERR_PNPM_FETCH_401` for private registries when no token was set. The build now leaves the lockfile unchanged unless the Mastra app is the workspace root. Fixes [#29279](https://github.com/mastra-ai/mastra/issues/29279).
