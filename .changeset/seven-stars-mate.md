---
'@mastra/core': patch
---

Remove node_modules-path dir which calls \_\_dirname at the top level and breaks some esm runtimes
