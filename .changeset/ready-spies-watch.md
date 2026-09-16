---
'@mastra/core': patch
---

Improve structured output option typing so processor-only fields now require a separate structuredOutput.model.

```ts
await agent.generate('Extract details', {
  structuredOutput: {
    model: 'openai/gpt-5-mini',
    instructions: 'Extract structured details from the prompt',
    schema: userSchema,
  },
});
```