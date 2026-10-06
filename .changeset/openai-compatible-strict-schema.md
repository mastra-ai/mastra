---
'@mastra/core': patch
---

Fixed structured output failing with 400 errors on OpenAI-compatible providers (for example Azure AI Foundry through `@ai-sdk/openai-compatible` with `supportsStructuredOutputs: true`). These providers send a strict JSON schema, but Mastra only prepared schemas for strict mode when the provider name started with `openai`, so requests failed with errors like `'uniqueItems' is not permitted` or `Missing 'subject'`. Schemas are now prepared whenever the model sends a strict JSON schema, and `null` values for optional fields are accepted in the response. Setting `strictJsonSchema: false` in the provider options keeps the schema unchanged.
