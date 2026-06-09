---
'@mastra/langfuse': patch
---

Added support for custom top-level trace metadata in the Langfuse exporter. Any keys you set under `metadata.langfuse` (other than the reserved `prompt` key) are now forwarded as top-level Langfuse trace metadata, so you can filter and group traces by them. Nested values are serialized with JSON.

```typescript
const tracingOptions = {
  metadata: {
    langfuse: {
      customerId: 'cust_123',
      tier: 'enterprise',
    },
  },
};
// produces langfuse.trace.metadata.customerId and langfuse.trace.metadata.tier
```
