---
'@mastra/core': minor
'@mastra/ai-sdk': patch
---

Add structured output support to agent.network() method. Users can now pass a `structuredOutput` option with a Zod schema to get typed results from network execution.

The stream exposes `.object` (Promise) and `.objectStream` (ReadableStream) getters, and emits `network-object` and `network-object-result` chunk types. The structured output is generated after task completion using the provided schema.

```typescript
const stream = await agent.network('Research AI trends', {
  structuredOutput: {
    schema: z.object({
      summary: z.string(),
      recommendations: z.array(z.string()),
    }),
  },
});

const result = await stream.object;
// result is typed: { summary: string; recommendations: string[] }
```
