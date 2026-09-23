---
'@mastra/core': minor
---

Added optional usage fields to observability span records: `inputTokens`, `outputTokens`, `totalTokens`, `reasoningTokens`, `cachedTokens`, `estimatedCost`, and `costUnit`. Spans saved without them read back as `null`.

```ts
await storage.createSpan({
  span: {
    traceId: 'trace-1',
    spanId: 'span-1',
    name: 'generate',
    spanType: 'model_generation',
    startedAt: new Date(),
    endedAt: new Date(),
    inputTokens: 120,
    totalTokens: 150,
    estimatedCost: 0.00123,
    costUnit: 'usd',
  },
});

const { span } = await storage.getSpan({ traceId: 'trace-1', spanId: 'span-1' });
span.totalTokens; // 150
```
