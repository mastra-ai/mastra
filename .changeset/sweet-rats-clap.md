---
'@mastra/deployer': patch
'@mastra/core': patch
---

Fixed a bug where mastra.db file location was inconsistently created when running mastra dev vs running a file directly (tsx src/index.ts for ex)
