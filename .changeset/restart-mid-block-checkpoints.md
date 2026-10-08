---
'@mastra/core': patch
---

Fixed `restart()` and boot-time recovery re-running work that had already finished inside a `.parallel()` or `.foreach()` block. If the process died while the block was still running, arms and items that had completed ran their side effects a second time. Each finished arm or item is now saved as it completes, and a restart continues with the ones that were still unfinished. Fixes [#26214](https://github.com/mastra-ai/mastra/issues/26214).

Running foreach snapshots have a cumulative 16 MiB write budget per execution attempt to bound repeated writes of accumulated outputs. Exceeding it fails the run explicitly while allowing the final failure snapshot to preserve completed results. For larger trusted workloads, set `options.maxForeachCheckpointBytes` to a larger positive safe integer. Terminal snapshots are outside the budget; a fresh process or a new attempt after a terminal result receives a fresh budget.

Large foreach blocks that previously succeeded may now fail when their cumulative snapshot writes exceed the default limit. To raise the budget to 64 MiB for a trusted workflow:

```typescript
import { createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';

const workflow = createWorkflow({
  id: 'batch-workflow',
  inputSchema: z.array(z.string()),
  outputSchema: z.array(z.string()),
  options: {
    maxForeachCheckpointBytes: 64 * 1024 * 1024,
  },
});
```

If a parallel child rejects before returning a step result, the block now waits for already-started siblings to settle and save successful results before propagating the original error.

If publishing a foreach progress event fails after an item succeeds, the run still saves that item's successful result. The run reports the publication failure but recovery skips the completed item's side effects.
