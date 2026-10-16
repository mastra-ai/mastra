---
'@mastra/deployer': patch
---

Fixed `mastra dev` failing when a `server.apiRoutes` handler or `bundler`/`deployer` option imports a workspace package that ships raw TypeScript. These packages are now inlined into the extracted config instead of being left as imports that Node cannot load. Their own dependencies still resolve from the workspace package, so dependencies installed only for that package (for example with pnpm) keep working.
