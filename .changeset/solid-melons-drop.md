---
'@mastra/core': minor
---

Added authorized node-scope discovery so scope navigation can include visible memberships without exposing hidden ones.

```ts
const memberships = await knowledge.getNodeScopes({
  id: node.id,
  scopeIds: vouchedScopeIds,
});
```
