---
'@mastra/deployer': patch
'mastra': patch
---

Fixed `bundler` options in `src/mastra/index.ts` being ignored when a project has file-based agents (`src/mastra/agents/<name>/`). In `mastra build`, all `bundler` options apply whether or not file-based agents exist. In `mastra dev`, `bundler.sourcemap` applies. Fixes [#29048](https://github.com/mastra-ai/mastra/issues/29048).
