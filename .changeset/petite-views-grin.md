---
'@mastra/platform-workspace': patch
---

Fixed `PlatformSandbox.clone()` silently dropping `checkpointName`, which prevented every sandbox from restoring from its captured checkpoint. `clone({ checkpointName })` now stabilizes the clone's sandbox id (the recovery key the platform hashes on `POST /sandbox`), so subsequent boots of the same session hit their prior checkpoint instead of always paying a fresh template build.

**Before**

```ts
// checkpointName was accepted but never stored — cloned sandbox got a
// random id, so the platform never found a matching checkpoint.
const child = template.clone({ checkpointName: 'mastra-recovery-session-42' });
await child.start(); // body.id: 'platform-sandbox-<random>' → 30–60 s build every time
```

**After**

```ts
const child = template.clone({ checkpointName: 'mastra-recovery-session-42' });
await child.start(); // body.id: 'mastra-recovery-session-42' → 5–10 s checkpoint restore
```

An explicit `id` still wins over `checkpointName` when both are passed.
