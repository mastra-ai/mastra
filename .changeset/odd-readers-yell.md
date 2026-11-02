---
'@mastra/deployer': patch
---

Fixed `mastra build` in monorepos packing and installing workspace packages that are already bundled into the output, along with all of their dependencies. Only workspace packages the output still imports at runtime are now packed into `workspace-module/` and installed, which makes the output smaller and the install faster. If your code loads a workspace package at runtime without a static import, for example with `createRequire().resolve()` or `node --import`, add it to `bundler.externals`. Fixes [#28303](https://github.com/mastra-ai/mastra/issues/28303).
