---
'mastra': patch
'@mastra/editor': patch
---

Fixed editing file-based agents (agents defined in an `agents/<name>/` folder) in Studio. The first save now creates the override instead of failing with a 404, and later saves, versions, and the agent's `editor` ownership settings work the same way they do for agents defined in code. Fixes [#26274](https://github.com/mastra-ai/mastra/issues/26274).
