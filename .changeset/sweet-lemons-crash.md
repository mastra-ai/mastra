---
'@mastra/core': patch
---

Fixed token usage and finish reason handling when a model router model is wrapped with AI SDK v7 `wrapLanguageModel`. The AI SDK compatibility shim nests usage and finish reason one level deeper, which made `result.usage` come back as the string `"0[object Object]…"` and made multi-step agent turns run to `maxSteps`. Mastra now unwraps repeated envelopes so token counts stay numbers and the loop stops on `stop`. Fixes https://github.com/mastra-ai/mastra/issues/23735 and https://github.com/mastra-ai/mastra/issues/23746
