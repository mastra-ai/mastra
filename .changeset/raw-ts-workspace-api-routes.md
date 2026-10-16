---
'@mastra/deployer': patch
---

Fixed `mastra dev` failing when a `server.apiRoutes` handler (or `bundler`/`deployer` config) imports a workspace package that ships raw TypeScript. These packages are now inlined into the extracted config instead of being left as imports Node cannot load, and their own dependencies still resolve from the workspace package, so packages installed only for that workspace package (for example with pnpm) keep working.
