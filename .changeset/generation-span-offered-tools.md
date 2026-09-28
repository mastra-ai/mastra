---
'@mastra/core': patch
---

Fixed the `tools` attribute on MODEL_GENERATION spans (PostHog `$ai_tools`) listing every registered tool even when input processors narrowed `activeTools`, and missing tools a processor added. It now holds the tools actually offered to the model across the generation's steps. ([#25302](https://github.com/mastra-ai/mastra/issues/25302))
