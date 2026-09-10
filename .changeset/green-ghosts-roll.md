---
'@mastra/core': patch
---

Added the DeepSeek V4.1 Flash model to the OpenCode Go provider. Reference it as `opencode-go/deepseek-flash` for type completion and correct capability detection — previously the model routed but had its `temperature`, `topP`, and `topK` settings stripped and native structured output disabled, because it was missing from the model registry. Closes #16.
