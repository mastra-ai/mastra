---
'@mastra/core': patch
---

Fixed structured output failing with Anthropic models when memory is enabled. The error "assistant message in the final position" occurred because the prompt sent to Anthropic ended with an assistant-role message, which is not supported when using output format. Resolves https://github.com/mastra-ai/mastra/issues/12800
