---
'@mastra/react': patch
---

**Every data hook now accepts `queryOptions`**

All query and mutation hooks take a single object argument and accept an optional `queryOptions` key, typed with TanStack Query's own option types. The options are applied last, so you can override any default (`enabled`, `staleTime`, `retry`, `refetchInterval`, `select`, `onSuccess`, and even `queryKey` or `queryFn`). A `select` override is reflected in the type of `data`.

```tsx
const { data: nameLength } = useDataset({
  datasetId,
  queryOptions: { staleTime: 60_000, select: dataset => dataset.name.length },
});

const { createDataset } = useDatasetMutations({
  queryOptions: { createDataset: { onSuccess: () => toast('Created') } },
});
```

Hooks that return several mutations take options keyed by the returned property name. Passing a callback such as `onSuccess` replaces the hook's built-in callback, including its cache invalidation. Hooks no longer skip the fetch when an id is empty. Pass `enabled` yourself when an id may be missing.

The new `MastraQueryOptions`, `MastraInfiniteQueryOptions` and `MastraMutationOptions` types are exported.

**Breaking: positional arguments and option bags were replaced**

Hooks that took positional arguments now take one object. `enabled`, `refetchInterval` and similar TanStack settings moved into `queryOptions`.

```tsx
// Before
useDataset(datasetId);
useStoredAgent(agentId, { status: 'draft', enabled: open }, requestContext);
useWorkflowRun(workflowId, runId, 2000);
useTraceSpans(traceId, { passive: true });

// After
useDataset({ datasetId });
useStoredAgent({ agentId, status: 'draft', requestContext, queryOptions: { enabled: Boolean(agentId) && open } });
useWorkflowRun({ workflowId, runId, queryOptions: { refetchInterval: 2000 } });
useTraceSpans({ traceId, passive: true });
```

Hooks are now generic over the returned data, so `ReturnType<typeof useX>['data']` resolves to `unknown`. Use the `@mastra/client-js` response type instead.

```ts
// Before
type Agent = NonNullable<ReturnType<typeof useAgent>['data']>;

// After
import type { GetAgentResponse } from '@mastra/client-js';
type Agent = GetAgentResponse;
```

Hooks don't guard on empty ids anymore:

```tsx
// Before: the hook waited until agentId was set
useAgent(agentId);

// After: pass the guard yourself
useAgent({ agentId, queryOptions: { enabled: Boolean(agentId) } });
```
