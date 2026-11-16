---
'@mastra/core': minor
---

Added an experimental `storageVersion` option to `createDurableAgent` and `createEventedAgent`. Set it to `2` to store new runs as a run header plus one row per step, so each save writes only what changed instead of rewriting the whole run. This keeps storage writes small for long agent runs.

```ts
const durableAgent = createDurableAgent({ agent, storageVersion: 2 });
```

Storage version 2 works with in-memory storage, `@mastra/pg`, and `@mastra/libsql`. On other adapters, the agent logs a warning and stores new runs as version 1. The default stays `1`, and runs stored before you change the option keep their version.
