---
'@mastra/deployer': patch
---

Fixed `mastra build` for projects with file-based agents. The deployer set in `src/mastra/index.ts` no longer ends up in the server bundle, the "Invalid Mastra config" warning no longer appears, and files in `src/mastra/public` are copied to the output. Fixes [#29996](https://github.com/mastra-ai/mastra/issues/29996).
