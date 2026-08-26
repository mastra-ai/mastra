---
'@mastra/e2b': minor
---

Added deterministic reattach to E2B sandboxes by provider sandbox ID. Pass the persisted E2B sandbox ID via the new `sandboxId` option (or `clone({ sandboxId })`) and `start()` connects to that exact sandbox — resuming it if paused — instead of discovering by logical id metadata. Only a typed "sandbox gone" error falls back to the usual lookup-or-create path; auth, quota, rate-limit, timeout, and network errors now propagate instead of silently creating a duplicate sandbox. The resolved provider ID is exposed via the new `sandbox.sandboxId` property so it can be persisted across restarts.

```ts
const sandbox = new E2BSandbox({ id: 'my-workspace', sandboxId: persistedId });
await sandbox.start();
await save(sandbox.sandboxId); // persist for the next process
```

Fixes https://github.com/mastra-ai/mastra/issues/22300
