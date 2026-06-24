---
'@mastra/observability': patch
---

Surface toModelOutput-transformed values in telemetry spans. Tool-result event spans now show the value the model actually receives (via toModelOutput) instead of being empty. Step input previews show tool result content instead of an opaque [tool-result] placeholder, making it easier to debug tools that transform their output before sending to the model.
