---
'@mastra/inngest': patch
---

Fixed custom `stopWhen` conditions on Inngest agents receiving tool results in Mastra's internal shape. Each step's `toolResults` now uses the same AI SDK tool-result parts as the default agent (`type: 'tool-result'`, `input`, `output`), so a condition that reads `toolResults[i].output` stops the run when it should. Fixes [#28519](https://github.com/mastra-ai/mastra/issues/28519).
