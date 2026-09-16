---
'@mastra/code-sdk': minor
---

Added `context.getSharedStorage()` for plugins that start nested controllers. It supplies the host's storage, backend, and vector instances so plugins can avoid opening shared SQLite files through separate native libraries.

```ts
const sharedStorage = context.getSharedStorage?.();
if (!sharedStorage) throw new Error('Shared storage requires a newer Mastra Code host.');
const nested = await bootLocalAgentController({ cwd: context.cwd, ...sharedStorage });
```

The host owns these instances. Nested controllers must not close them or run storage maintenance on them.
