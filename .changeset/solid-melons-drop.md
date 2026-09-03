---
'@mastra/core': minor
---

Added authorized node-scope discovery and exact canonical-name filtering so scope navigation and reserved-node lookup stay complete without exposing hidden memberships.

```ts
const memberships = await knowledge.getNodeScopes({
  id: node.id,
  scopeIds: vouchedScopeIds,
});
```
