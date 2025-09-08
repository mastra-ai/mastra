---
'@mastra/deployer': patch
---

Fix bugs related to `bundler.transpilePackages` usage during `mastra dev`.

Users reported in [#6852](https://github.com/mastra-ai/mastra/issues/6852) that `mastra dev` broke when workspace dependencies used packages from `node_modules`. This should be fixed now.
