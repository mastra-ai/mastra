---
'@mastra/redis-streams': minor
---

Make `RedisStreamsPubSub` survive Redis connection drops, and add topic cleanup to bound memory.

**Fixed** — a dropped Redis connection (restart, failover, idle reset) no longer wedges the client. The clients were missing the `'error'` listener node-redis requires, so a socket drop threw an uncaughtException and left the client unable to reconnect, hanging every later publish. It now reconnects on its own. The read loop also recovers when a stream's consumer group disappears, instead of retrying forever.

**Added** — `clearTopic(topic)` deletes a topic's stream so finished runs release their memory instead of accumulating. The durable-agent runtime calls it during cleanup.

**Added** — an opt-in `streamIdleTtlMs` option puts a rolling time-to-live on each stream. Active streams keep refreshing it and never expire mid-flight; abandoned ones (e.g. a crashed run) are removed after they go quiet.

```ts
const pubsub = new RedisStreamsPubSub({
  url: 'redis://localhost:6379',
  streamIdleTtlMs: 24 * 60 * 60 * 1000, // remove streams idle for 24h
});

// free a finished topic's stream immediately
await pubsub.clearTopic('workflow.events.run-123');
```
