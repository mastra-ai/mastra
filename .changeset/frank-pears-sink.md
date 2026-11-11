---
'@mastra/deployer': patch
---

Fixed `mastra build` with file-based agents treating the generated agents entry as the Mastra config. The deployer is now removed from `src/mastra/index.ts`, so its build-time dependencies no longer end up in the server bundle, the "Invalid Mastra config" warning no longer appears, and files in `src/mastra/public` are copied to the output. The generated entry also runs in Cloudflare Workers now. Fixes [#29996](https://github.com/mastra-ai/mastra/issues/29996).
