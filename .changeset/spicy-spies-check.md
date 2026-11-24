---
'@mastra/core': patch
---

Fixed a default-engine workflow run being overwritten by a stalled process after another process took it over. When a process stalls past its run lease (for example a blocked event loop or a cut database connection), recovery on another instance takes the run over. Previously the stalled process kept saving when it woke up, so a finished run could go back to `running` and steps the new owner already ran could run again.

Now, on storage adapters with run fencing, storage refuses those saves and the stalled process's call rejects with `STORAGE_RUN_FENCE_CONFLICT`. No `onFinish` or `onError` callback fires for it.

```ts
import { MastraError } from '@mastra/core/error';

// Before: a stalled process could resolve and overwrite the run another process finished
const result = await run.start({ inputData });

// After: it rejects instead, and the run keeps the new owner's saves
try {
  await run.start({ inputData });
} catch (error) {
  if (error instanceof MastraError && error.id === 'STORAGE_RUN_FENCE_CONFLICT') {
    const current = await workflow.getWorkflowRunById(run.runId);
  }
}
```

This applies to default-engine runs that hold a run lease (see `autoRestartActiveRuns`). Storage adapters without run fencing behave as before. The step that was running when the run was taken over can still finish, so keep steps idempotent.
