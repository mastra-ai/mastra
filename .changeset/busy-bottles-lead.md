---
'@mastra/core': minor
---

Added live-tail PubSub subscriptions with `startFrom: "latest"` and an explicit `supportsOffsets` capability.

```typescript
await pubsub.subscribe(topic, callback, { startFrom: 'latest' });
```

The default remains `"earliest"`, and existing consumer groups keep their checkpoint.
