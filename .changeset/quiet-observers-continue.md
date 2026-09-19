---
'@mastra/memory': patch
---

Made observational-memory retries and terminal failure handling configurable on both OM stages, and stopped failed observation cycles from skipping their input.

`observation` and `reflection` each accept `maxRetries` (retries after the initial model call, default `8`) and `failurePolicy` (`'abort'` by default, or `'continue'`). `maxRetries` governs OM's own retry ladder; the stage's model call is configured with no provider-level retries, so it is the single retry knob. With `'continue'`, the stage retries as configured, emits the existing failure diagnostic, keeps the failed input pending for a later cycle, and lets the main agent turn continue. A Reflector failure under `'continue'` leaves already-persisted observations committed and defers reflection to the next threshold crossing. Persistence, indexing, transform, locking, invariant, and explicit abort failures remain fatal, and `'continue'` has no backstop for a sustained outage: pending messages keep accruing in the main agent's context.

```ts
import { Memory } from '@mastra/memory';

const memory = new Memory({
  options: {
    observationalMemory: {
      observation: { maxRetries: 8, failurePolicy: 'continue' },
      reflection: { maxRetries: 8, failurePolicy: 'continue' },
    },
  },
});
```

Two bookkeeping fixes also apply under the default `'abort'` policy, where a failed async-buffer cycle is swallowed rather than rethrown: the async buffer cursor no longer advances past messages a failed cycle never observed, and multi-thread messages are marked observed after the observer output is parsed rather than before the call. Previously both advanced on failure, so the unobserved messages were silently skipped instead of being retried in a later cycle.

Structured-extractor calls now run on the same `maxRetries` ladder as the rest of the stage instead of having no retry coverage, and a cancellation wrapped inside another error is recognised as an abort everywhere, so `'continue'` can never absorb a cancelled turn.
