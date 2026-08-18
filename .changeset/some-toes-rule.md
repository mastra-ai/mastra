---
'@mastra/redis-streams': minor
---

Added live-tail Redis Streams subscriptions with `startFrom: "latest"`. New consumer groups skip retained entries while existing groups keep their checkpoint. Subscriptions also preserve their position when Redis recreates a missing group.

```typescript
await pubsub.subscribe(topic, callback, { startFrom: 'latest' });
```
