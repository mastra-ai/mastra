---
'@mastra/core': minor
---

Added per-message Signal metadata to Channel handlers. Use `ctx.signalMetadata` to attach serializable, non-sensitive context that follows both idle and active message delivery:

```typescript
handlers: {
  onDirectMessage: async (thread, message, defaultHandler, ctx) => {
    ctx.signalMetadata.attachmentIds = ['file-1']
    await defaultHandler(thread, message)
  },
}
```
