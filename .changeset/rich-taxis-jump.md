---
'@mastra/deployer': patch
'@mastra/deployer-cloud': patch
'@mastra/core': patch
'mastra': patch
---

Use a shared `getAllToolPaths()` method from the bundler to discover tool paths.
