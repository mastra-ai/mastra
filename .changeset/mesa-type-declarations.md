---
'@mastra/mesa': patch
---

Fixed `@mastra/mesa` being published without TypeScript type declarations. The package now ships `dist/index.d.ts`, so TypeScript projects no longer get "Could not find a declaration file for module '@mastra/mesa'". Fixes [#26377](https://github.com/mastra-ai/mastra/issues/26377).
