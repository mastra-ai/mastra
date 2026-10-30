---
'@mastra/deployer': patch
'mastra': patch
---

Fixed `bundler` options in `src/mastra/index.ts` being ignored when a project has file-based agents (`src/mastra/agents/<name>/`). Options such as `sourcemap`, `externals`, `minify` and `transpilePackages` now apply in `mastra dev` and `mastra build` whether or not file-based agents exist. Fixes [#29048](https://github.com/mastra-ai/mastra/issues/29048).
