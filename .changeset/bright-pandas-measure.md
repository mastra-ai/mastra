---
'@mastra/spanner': minor
---

Added configurable age-based pruning for Google Cloud Spanner observability spans and metrics when metrics storage is enabled.

```typescript
const storage = new SpannerStore({
  ...connection,
  disableMetrics: false,
  retention: {
    observability: {
      spans: { maxAge: '30d' },
      metrics: { maxAge: '7d' },
    },
  },
});

await storage.prune();
```
