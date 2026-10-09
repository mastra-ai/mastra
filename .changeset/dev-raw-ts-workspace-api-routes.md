---
'@mastra/deployer': patch
---

Fixed `mastra dev` failing to start when a `server.apiRoutes` handler imports a workspace package that exports raw TypeScript sources (for example `"exports": { ".": "./src/index.ts" }`). Errors like `Unknown file extension ".ts"` or `Cannot find module '.../src/sum'` no longer happen, and dependencies that only the workspace package declares now load too. Fixes [#26540](https://github.com/mastra-ai/mastra/issues/26540).
