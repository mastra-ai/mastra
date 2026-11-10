---
'@mastra/core': patch
---

Fixed Azure OpenAI requests failing with `Invalid schema for function` when strict mode is on. With `AzureOpenAIGateway` or an AI SDK 5 `@ai-sdk/azure` model, setting `strictJsonSchema: true` also makes every tool strict, and Azure rejected tool schemas with optional fields or keywords such as `uniqueItems`. Mastra now prepares tool schemas for strict mode on these models, as it already does for the structured output schema. Requests without strict mode are unchanged. See #28593.
