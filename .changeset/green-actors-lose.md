---
'@mastra/code-sdk': minor
'@mastra/factory': patch
'@mastra/core': patch
---

Added per-mode thinking levels to model pack definitions and runtime model resolution. SDK consumers can set `thinkingLevels: { build: 'high', fast: 'low' }` on a `ModePack`; request resolution uses the current slot's value unless the session has an explicit `/think` override.
