---
'@mastra/railway': patch
---

Refresh Railway sandbox checkpoints 3 minutes before idle destroy instead of 10 seconds, and expose an on-demand `captureCheckpoint()` method

**Wider safety-net margin**

Extends the pre-reap refresh margin from 10s to 180s so a Cloud Run cold start or scale event during the refresh window doesn't lose the race with Railway's idle destroy. Callers running with an idle timeout shorter than 3 minutes will now see the refresh fire at the 1-second floor almost immediately after start.

**Public `captureCheckpoint()`**

Adds a public, on-demand checkpoint capture to `RailwaySandbox` so callers can refresh the recovery checkpoint at semantic moments (turn end, session idle, pre-teardown) instead of waiting for the idle-timer safety net. Concurrent captures coalesce with any in-flight timer-driven refresh, so a single Railway checkpoint quota is consumed per capture window. Returns `'captured' | 'skipped' | 'coalesced'` for observability.

```ts
const sandbox = new RailwaySandbox({ token, checkpointName: 'my-project' });
await sandbox.start();
// ... run some work ...
const outcome = await sandbox.captureCheckpoint(); // 'captured'
```
