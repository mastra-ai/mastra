---
'@mastra/core': patch
---

Adds type inference for `mastra.get*ById` functions. Only those registered at the top level mastra instance will get inferred. MCP and tool id's do not get inferred yet, those need additional changes.
