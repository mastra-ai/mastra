---
'@mastra/server': patch
'@mastra/core': patch
---

Studio overrides for file-based agents now respect the agent's `editor` ownership settings, so fields owned by the agent folder are not stored or exported. Code-source editors write these overrides to per-agent override files, the same as for agents defined in code. Fixes [#26274](https://github.com/mastra-ai/mastra/issues/26274).
