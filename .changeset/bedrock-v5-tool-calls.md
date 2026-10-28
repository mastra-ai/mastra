---
'@mastra/code-sdk': patch
'mastracode': patch
---

Fixed tool calls on Amazon Bedrock models failing with `AI_TypeValidationError` when zod 4.4 or newer is installed. Bedrock streams the start of a tool call without its input, which the old `@ai-sdk/amazon-bedrock` 3.x schema rejected. The Bedrock provider is now `@ai-sdk/amazon-bedrock` v5, which accepts these events.
