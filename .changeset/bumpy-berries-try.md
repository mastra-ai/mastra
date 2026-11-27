---
'@mastra/deployer': patch
'mastra': patch
---

Fixed `mastra dev` ignoring `bundler.transpilePackages`, so listed packages with uncompiled TypeScript now load in the dev server. Fixes [#19380](https://github.com/mastra-ai/mastra/issues/19380).
