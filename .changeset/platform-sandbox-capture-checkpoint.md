---
'@mastra/platform-workspace': patch
---

Add public `captureCheckpoint()` method to `PlatformSandbox` — mirrors `@mastra/railway`'s `RailwaySandbox.captureCheckpoint()` so callers (e.g. a factory-side scheduler) can capture the recovery checkpoint on demand at semantic moments (turn end, session-idle, pre-teardown) without having to know which provider is underneath.

```ts
const result = await sandbox.captureCheckpoint();
switch (result.status) {
  case 'captured':
  case 'coalesced':
    await persistBinding({ sessionId, checkpointName: result.checkpointName });
    break;
  case 'skipped':
    // result.reason: 'no-checkpoint-name-configured' | 'sandbox-not-running'
    break;
}
```

- POSTs to `/v1/projects/:projectId/sandbox/:sandboxId/checkpoint` with the caller-supplied recovery key (the `id` the sandbox was constructed with) as the body, matching the shape the workspace-proxy expects.
- Coalesces concurrent callers on the same instance onto a single upstream request, so N simultaneous turn-end fires do not each round-trip the proxy.
- Returns `{ status: 'skipped', reason: 'no-checkpoint-name-configured' }` when the sandbox was constructed without a caller-supplied `id` (an auto-generated random id is never a meaningful recovery key), and `{ status: 'skipped', reason: 'sandbox-not-running' }` when the sandbox has not been started yet.
- Normalizes upstream "sandbox destroyed" outcomes (a 410 from the proxy, or the proxy's own `skipped` status) to `{ status: 'skipped', reason: 'sandbox-not-running' }` — the discriminant matches the pre-flight case so callers branch uniformly, and the sandbox's local state is cleared as a side effect so the next `start()` provisions fresh instead of reattaching to a dead id.
- Transport failures other than 410 (5xx, 429) propagate as `PlatformApiError` for the caller to handle.
