---
'@mastra/observability': patch
---

Tool telemetry is now more informative for tools that transform their output before sending to the model. Tool-result spans in traces show the actual value the model received instead of being empty, and step input previews display the tool result content instead of an opaque `[tool-result]` placeholder. This makes it easier to debug tool behavior in Langfuse, Datadog, and other observability providers.
