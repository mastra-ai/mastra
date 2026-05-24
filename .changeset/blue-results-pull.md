---
'@mastra/core': minor
'@mastra/client-js': minor
'@mastra/server': minor
'mastra': minor
---

Added scheduling options for Harness queued turns. Use `priority` to run more urgent queued work first, `deadline` to expire stale queued turns before they start, and `notBefore` to delay a turn until a future time.

```ts
await session.queue({
  content: "Follow up on the report",
  priority: 10,
  notBefore: Date.now() + 60_000,
  deadline: Date.now() + 300_000,
});
```

The server queue route and generated client types accept the same fields, so remote Harness clients can use the scheduling controls without schema drift.
