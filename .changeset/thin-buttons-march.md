---
'@mastra/core': minor
---

Added \_internal field support for tool results. Tools can now return debug/internal data in the \_internal field, which is preserved in storage and UI but automatically stripped when sending to the LLM. This allows developers to include debugging information (raw API responses, processing times, etc.) without cluttering the model's context.

**Usage:**

```typescript
const myTool = createTool({
  id: 'myTool',
  execute: async () => {
    return {
      result: 'The weather is sunny',
      _internal: {
        rawResponse: { temp: 72 },
        processingTime: 150,
      },
    };
  },
});
```

Fixes #12385
