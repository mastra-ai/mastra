---
'@mastra/core': patch
---

Adds native @ai-sdk/deepseek provider support instead of using the OpenAI-compatible fallback.

```typescript
const agent = new Agent({
  model: 'deepseek/deepseek-reasoner',
});

// With provider options for reasoning
const response = await agent.generate('Solve this problem', {
  providerOptions: {
    deepseek: {
      thinking: { type: 'enabled' },
    },
  },
});
```

Also updates the doc generation scripts so DeepSeek provider options show up in the generated docs.
