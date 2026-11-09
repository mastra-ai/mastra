---
'@mastra/core': patch
---

Fixed `observe(runId, { offset })` on evented agents that use a cross-process PubSub such as Redis Streams with the default in-memory server cache. Resuming a run no longer repeats events from before the offset, and an offset past the end of a finished run now returns nothing.

```ts
const mastra = new Mastra({
  agents: { agent: createEventedAgent({ agent }) },
  pubsub: new RedisStreamsPubSub({ url: 'redis://localhost:6379' }),
  storage: new LibSQLStore({ url: 'file:mastra.db' }),
});

// Resumes exactly after the last chunk received
await mastra.getAgent('agent').observe(runId, { offset: lastIndex + 1 });
```

When the workflows store lets other processes run steps (PostgreSQL), events from those processes still can't be numbered by an in-memory cache. Mastra now logs a warning in that setup; configure a shared cache such as `RedisServerCache`. Fixes #28324.
