---
'@mastra/deployer': patch
---

Fixed `mastra build` and `mastra dev` running out of memory on large apps since 1.79.0. Reading the `deployer`, `bundler` and `server` options from the Mastra config no longer loads every installed package those options import. Raw TypeScript workspace packages are still supported. Fixes [#28645](https://github.com/mastra-ai/mastra/issues/28645).
