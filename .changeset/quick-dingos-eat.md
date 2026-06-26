---
'@mastra/core': minor
---

Add inline JSON prompt injection mode to structured output

When using structured output, you can now pass `jsonPromptInjection: 'inline'` to append JSON schema instructions to the latest user message instead of the system prompt. This preserves the system prompt prefix for better provider-side caching while still guiding the model to return valid JSON.

```ts
const result = await agent.generate('What is the weather?', {
  structuredOutput: {
    schema: weatherSchema,
    jsonPromptInjection: 'inline',
  },
});
```

The existing `jsonPromptInjection: true` (system message injection) and `jsonPromptInjection: 'system'` behaviors continue to work unchanged.
