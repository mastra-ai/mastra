---
'@mastra/core': patch
---

Fixed structured output option typing so processor-only fields require a separate `structuredOutput.model`.

**Before**

```ts
await agent.generate('Extract details', {
  structuredOutput: {
    instructions: 'Extract structured details from the prompt',
    schema: userSchema,
  },
});
```

**After**

```ts
await agent.generate('Extract details', {
  structuredOutput: {
    model: 'openai/gpt-5-mini',
    instructions: 'Extract structured details from the prompt',
    schema: userSchema,
  },
});
```
