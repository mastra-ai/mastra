---
'@mastra/deployer': patch
---

Fixed TypeScript path alias resolution in workspace packages configured with transpilePackages. The bundler now correctly resolves imports using path aliases (e.g., @/_ → ./src/_) in transpiled workspace packages, preventing build failures in monorepo setups.
