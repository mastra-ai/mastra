---
'@mastra/railway': patch
---

Widen `RailwaySandbox.captureCheckpoint()` return type to a discriminated object so callers get the checkpoint name inline instead of having to reach back into the sandbox for it.

Before:

```ts
const outcome = await sandbox.captureCheckpoint(); // 'captured' | 'skipped' | 'coalesced'
```

After:

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

Both `captured` and `coalesced` now carry `checkpointName` — they both represent a successful capture the caller can persist against. `skipped` carries a machine-readable `reason` so the set stays extensible without another return-shape change.

The prior return shape landed one release ago and has no consumers yet, so this is a straight fix rather than a semver-breaking change.
