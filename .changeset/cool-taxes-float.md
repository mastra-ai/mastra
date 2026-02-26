---
'@mastra/core': patch
---

Added optional `tracingOptions` parameter to `Harness.sendMessage()` so that traces from Harness interactions are properly linked in observability tools like Datadog instead of appearing as disconnected entries.

```ts
await harness.sendMessage({
  content: 'Hello!',
  tracingOptions: {
    traceId: 'abc123',
    parentSpanId: 'def456',
    metadata: { userId: 'u-1' },
    tags: ['production'],
  },
});
```

See [#13540](https://github.com/mastra-ai/mastra/issues/13540).
