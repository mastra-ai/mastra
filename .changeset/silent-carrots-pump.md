---
'@mastra/core': patch
---

Fixed `agent.stream()` callbacks so that `onStepFinish` and `onFinish` now preserve the provider-level `usage.raw` object on `LanguageModelUsage`. This lets consumers inspect provider-specific cache metrics (e.g., Anthropic and Bedrock prompt caching) directly from the callback payload without having to wrap the stream.

Closes #15510.
