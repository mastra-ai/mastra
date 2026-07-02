---
'@mastra/core': patch
---

Added optional filter arguments to `Dataset.listExperiments()` and `Dataset.listExperimentResults()`. The storage layer already accepted these filters — they are now reachable from the `Dataset` handle. All new parameters are optional and existing callers are unaffected.

**Before:**

```typescript
const { experiments } = await dataset.listExperiments({ page: 0, perPage: 10 });
const baselineOnly = experiments.filter(e => e.agentVersion === 'v1');
```

**After:**

```typescript
const { experiments } = await dataset.listExperiments({
  targetType: 'agent',
  targetId: 'my-agent',
  agentVersion: 'v1',
  status: 'completed',
  page: 0,
  perPage: 10,
});
```

`listExperiments` accepts: `targetType`, `targetId`, `agentVersion`, `status`, tenancy `filters`.
`listExperimentResults` accepts: `traceId`, `status`, tenancy `filters`.

Enables baseline vs variant read patterns without client-side filtering or bypassing `Dataset`.
