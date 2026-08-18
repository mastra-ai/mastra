---
'@mastra/core': minor
---

Added checkpoint support to LocalSandbox and a checkpoint capability signal to sandboxes. Sandboxes now expose `supportsCheckpoints` so features can detect whether `snapshot()` persists real state. LocalSandbox gained filesystem-backed checkpoints: pass `checkpointName` to seed the working directory on `start()` and persist it on `snapshot()`, and `seedCheckpointName` as a boot-only fallback (for example a shared warm base image) that never gets overwritten by later snapshots.

```ts
import { LocalSandbox } from '@mastra/core/workspace';

const sandbox = new LocalSandbox({
  workingDirectory: './workspace',
  checkpointName: 'session-123',
  seedCheckpointName: 'repo-base',
});

await sandbox.start();
await sandbox.snapshot();
```
