---
'@mastra/observability': patch
---

Added the `tools` attribute to `MODEL_INFERENCE` spans. It holds the tool definitions sent to the provider on that call, so exporters can read the tools for each model call.
