---
'@mastra/redis-streams': patch
'@mastra/valkey-streams': patch
---

Reclaimed a finished agent run's stream in about an hour instead of waiting out the seven-day idle backstop (COR-1534).

Idle retention is now resolved per topic. Topics carrying a single agent run or thread (`agent.stream.*`, `agent.control.*`, `agent.thread-stream.*`) take the one-hour retention their cached replay log already uses: they are fan-out, so no consumer depends on their backlog, and the record that authorizes reading them expires in a day. Every other topic keeps `streamIdleTtlMs`, seven days by default, which work queues need so a grouped consumer that was offline still finds its backlog.

`streamIdleTtlMs` still caps every topic, so lowering it lowers run topics too, and `0` disables expiry everywhere as before. No configuration change is needed:

```typescript
// Run topics now expire in an hour; work queues still get seven days.
new RedisStreamsPubSub({ url });

// Lowering the backstop still lowers everything.
new RedisStreamsPubSub({ url, streamIdleTtlMs: 30 * 60 * 1000 });
```
