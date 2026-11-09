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

Steps that run in another process, such as a dedicated worker, still publish unnumbered events with an in-memory cache, and now log a warning. Configure a shared cache such as `RedisServerCache` for that setup or when observers reconnect through another server replica. Fixes #28324.
