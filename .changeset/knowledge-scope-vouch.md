---
'@mastra/core': minor
---

Added an optional `vouch` hook to `Knowledge`. When a scope template needs a parameter the run did not provide, Knowledge asks the hook, passing the run's trusted agent scopes, and the hook can answer asynchronously. A vouched scope only anchors the run to that scope; it never makes the caller its owner.

```ts
const knowledge = new Knowledge({
  storage,
  scopes: { 'project:$projectId': { access: [{ principal: 'team:$orgId', role: 'readonly' }] } },
  vouch: async ({ parameter, scopes }) =>
    parameter === 'orgId' ? scopes?.find(scope => scope.startsWith('org:'))?.slice(4) : undefined,
});
```
