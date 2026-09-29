---
'@mastra/core': patch
---

Fixed the `tools` attribute on MODEL_GENERATION spans (and PostHog `$ai_tools`) listing every registered tool even when an input processor narrowed `activeTools` or added tools for a step. The attribute now contains the tools actually offered to the model across the steps of the generation. ([#25302](https://github.com/mastra-ai/mastra/issues/25302))
