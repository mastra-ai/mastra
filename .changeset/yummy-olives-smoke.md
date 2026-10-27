---
'@mastra/redis-streams': minor
---

Added `retainTerminalEvents` to `trimTopic` to preserve compact run outcomes and execution authority metadata while removing saved output. Upgrade alongside `@mastra/core` for opted-in thread outcome recovery.

```ts
await pubsub.trimTopic(topic, { runId, retainTerminalEvents: true });
```
