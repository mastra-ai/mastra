---
'@mastra/core': patch
---

Fixed structured output on Azure OpenAI models failing with `Invalid schema for response_format` when strict mode is on. This affects `@ai-sdk/azure` models from AI SDK 6, which use strict mode by default, and `AzureOpenAIGateway` or AI SDK 5 `@ai-sdk/azure` models with `strictJsonSchema: true`. Defaults are unchanged: `AzureOpenAIGateway` and AI SDK 5 models still send non-strict requests unless you opt in, and tool schemas are not prepared for strict mode yet. See #28593.
