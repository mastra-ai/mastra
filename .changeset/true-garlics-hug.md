---
'@mastra/deployer': patch
---

Reduced the memory `mastra build` and `mastra dev` use to read the `deployer`, `bundler` and `server` options from the Mastra config. Since 1.79.0 this step loaded every installed package those options import, which could run large apps out of memory ([#28645](https://github.com/mastra-ai/mastra/issues/28645)). Raw TypeScript workspace packages are still supported.
