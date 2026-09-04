---
'@mastra/core': patch
---

Fixed dynamic agent models being resolved repeatedly when an agent uses tools from multiple sources. Each generation or stream now consistently uses a single model snapshot for all tools, including per-call model overrides.
