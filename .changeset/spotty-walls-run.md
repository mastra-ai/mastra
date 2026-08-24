---
'@mastra/factory': minor
---

Added a durable Factory action center for unresolved automation failures and proposed work waiting for approval. Per-user read/archive receipts survive reloads, while retries and canonical reconciliation resolve failures for every project member.

Historical decision state is repaired on startup: accepted transitions become `succeeded`, obsolete terminal work and proposals become `superseded`, and active unresolved failures remain `failed`. Retry is offered only when the persisted failure code allows it.

**Before**

```ts
// Failed automation and proposed runs were visible only on their board cards.
```

**After**

```ts
const attention = await fetch(`/web/factory/projects/${factoryId}/attention`).then(response => response.json());
// attention.items: per-user unresolved failures
// attention.approvalCount: project-wide proposed work
```
