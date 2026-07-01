---
'@mastra/core': minor
---

Added opt-in storage retention. Declare per-table `maxAge` policies in the `retention` config, then call `storage.prune()` to delete rows older than their age. Anything you don't configure is kept forever, so there is no change until you opt in.

`prune()` is safe on large tables: it deletes in bounded, batched, resumable, cancellable chunks and never locks the database for long. Call it from your own scheduler; when a result reports `done: false`, eligible rows remain and the next run continues. `prune()` only deletes rows — reclaiming disk to the OS is left to the underlying database and the operator.

```typescript
const storage = new MastraCompositeStore({
  id: 'composite',
  retention: {
    memory: { messages: { maxAge: '30d' }, threads: { maxAge: '90d' } },
    observability: { spans: { maxAge: '7d' } },
  },
  domains: {
    /* ... */
  },
});

// Wire this to your own cron — Mastra never runs it for you.
const results = await storage.prune();
```
