---
'@mastra/core': patch
---

Fixed agent tool calls failing when the tool's input schema transforms values, for example a string decoded into a `URL` ([#27259](https://github.com/mastra-ai/mastra/issues/27259)). The tool now runs and receives the transformed value. Before, the call returned a validation error and the tool never ran. This affected tools with `strict: false` and models from providers like Mistral or Qwen.
