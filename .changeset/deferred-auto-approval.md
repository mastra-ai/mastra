---
'@mastra/core': patch
---

Add an opt-in `deferredAutoApproval` Harness config option for auto-approved and auto-denied tool approvals.

```ts
const harness = new Harness({
  // ...
  deferredAutoApproval: true,
});
```

When enabled, Harness queues automatic approval and denial decisions until the current stream has finished, then resumes each pending tool approval in order. This helps apps avoid resuming before the awaiting-input state is ready. No migration is required; the default inline behavior is unchanged unless `deferredAutoApproval` is set.
