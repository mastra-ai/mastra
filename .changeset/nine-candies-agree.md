---
'@mastra/railway': minor
---

Added checkpoint-backed restart and reconnect support to `RailwaySandbox`. Pass `checkpointName` to save the sandbox filesystem before idle teardown and restore it when a sandbox must be recreated.

```ts
const sandbox = new RailwaySandbox({
  checkpointName: 'mastra-workspace-cache',
  idleTimeoutMinutes: 30,
})
```

Added `restart()` and automatic retry for unavailable Railway sandboxes during command execution. Fixed checkpoint refresh scheduling, restart checkpoint flushing, teardown cleanup, and retry classification so checkpoint state is preserved without replaying commands after ambiguous transport failures.
