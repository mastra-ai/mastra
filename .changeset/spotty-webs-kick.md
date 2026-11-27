---
'@mastra/deployer': patch
'mastra': patch
---

Fixed `bundler.transpilePackages` being ignored by `mastra build` and `mastra dev`. Installed packages that ship uncompiled TypeScript can now be listed there, and Mastra transpiles and bundles them instead of leaving them external and crashing at startup with `ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING`. Fixes [#19380](https://github.com/mastra-ai/mastra/issues/19380).
