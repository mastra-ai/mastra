---
"@mastra/langfuse": patch
---

Forward custom keys from `mastra.metadata.langfuse` as `langfuse.trace.metadata.*` attributes so users can filter and group Langfuse traces by custom metadata keys.

```ts
// Before: custom keys were silently dropped
// After: custom keys are forwarded to Langfuse trace metadata

const result = await agent.generate('Hello', {
  telemetry: {
    metadata: {
      langfuse: {
        customerId: 'abc-123',
        environment: 'production',
        // prompt linking still works as before
        prompt: { name: 'my-prompt', version: 1 },
      },
    },
  },
});

// Langfuse trace now contains:
// langfuse.trace.metadata.customerId = 'abc-123'
// langfuse.trace.metadata.environment = 'production'
// langfuse.observation.prompt.name = 'my-prompt'
```
