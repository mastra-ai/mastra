---
'@mastra/server': minor
---

Dynamic workflow discovery, execution, and run-control routes now require an authenticated caller. Requests without caller identity return `401`; cross-owner workflow and run requests return non-disclosing `404` responses. New runs derive their `resourceId` from request context, and client-provided resource IDs can't override it.

```ts
const response = await fetch('/api/workflows/campaign-workflow/runs', {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}` },
})
```

Before upgrading, assign `authorId` to existing dynamic definitions and `resourceId` to resumable runs. Legacy unowned definitions and runs remain fail-closed; local Studio deployments must configure authentication rather than treating missing identity as public access.
