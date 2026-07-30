---
'@mastra/platform-workspace': patch
---

Fixed `PlatformSandbox.clone()` silently ignoring `checkpointName`. Clones created with `clone({ checkpointName })` now reuse a matching captured checkpoint on `start()` instead of always provisioning a fresh sandbox, so repeated boots of the same session start much faster.

```ts
const child = template.clone({ checkpointName: 'mastra-recovery-session-42' });
await child.start(); // Reuses the captured checkpoint when one is available.
```

An explicit `id` still takes precedence over `checkpointName` when both are passed.
