---
'@mastra/redis-streams': patch
'@mastra/valkey-streams': patch
---

Reclaimed a finished agent run's stream within a day instead of waiting out the seven-day idle backstop.

Idle retention is now resolved per topic. Topics carrying a single agent run or thread (`agent.stream.*`, `agent.control.*`, `agent.thread-stream.*`) take the retention their cached replay log already uses — a day for run topics, matching the lifetime of the record that authorizes reading them, and an hour for thread streams. They are fan-out, so no consumer depends on their backlog. Every other topic keeps `streamIdleTtlMs`, seven days by default, which work queues need so a grouped consumer that was offline still finds its backlog.

`streamIdleTtlMs` still caps every topic, so lowering it lowers run topics too, and `0` disables expiry everywhere as before. No configuration change is needed:

```typescript
// Run topics now expire in a day, thread streams in an hour; work queues still get seven days.
new RedisStreamsPubSub({ url });

// Lowering the backstop still lowers everything.
new RedisStreamsPubSub({ url, streamIdleTtlMs: 30 * 60 * 1000 });
```

Also raised the `@mastra/core` peer floor to 1.86.0, the first release that exports the per-topic retention helper these transports now read.
