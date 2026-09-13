---
'@mastra/core': patch
---

Fixed structured output requests to OpenAI-compatible providers failing with `400` errors such as `'uniqueItems' is not permitted` or `Missing 'subject'` in a nested `required` list. `@ai-sdk/openai-compatible` chat models send the JSON schema with `strict: true` by default, but the strict-mode schema preparation only ran when the provider id started with `openai`, so a provider created with `createOpenAICompatible({ name: 'azure-foundry', supportsStructuredOutputs: true })` (or any provider built on that package, such as Cerebras or Together) received an unprepared schema. The preparation now runs for those models too, and it is skipped when strict mode is disabled through `providerOptions` (`openaiCompatible.strictJsonSchema: false`, or the provider-named key). Follows up on #23321.

```ts
const azure = createOpenAICompatible({
  name: 'azure-foundry',
  baseURL: process.env.AZURE_FOUNDRY_URL,
  apiKey: process.env.AZURE_FOUNDRY_KEY,
  supportsStructuredOutputs: true,
});

await agent.generate('Summarize the ticket.', {
  structuredOutput: {
    schema: z.object({ tags: z.array(z.string()).min(1).max(5), owner: z.object({ name: z.string(), team: z.string().optional() }) }),
  },
});
// previously: 400 "'minItems' is not permitted" — now the schema is sent in strict-compatible form
```
