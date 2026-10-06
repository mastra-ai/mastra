---
'@mastra/core': minor
---

Added Knowledge scope structure. Declare the scopes your app always has with `structure`, and scope types that are created on first use with `scopes`. `reconcile()` writes the declared structure; `materializeScope()` creates one scope from its matching type.

```ts
import { Knowledge } from '@mastra/core/knowledge';

const knowledge = new Knowledge({
  structure: {
    scopes: [
      { address: 'org:acme', name: 'Acme' },
      { address: 'features', name: 'Features', parentAddresses: ['org:acme'] },
    ],
  },
  scopes: {
    'project:$projectId': { access: [{ principal: 'parent', role: 'readonly' }] },
  },
});

await knowledge.reconcile();

await knowledge.materializeScope({
  address: 'project:atlas',
  parentAddresses: ['org:acme'],
  contextualScopeAddress: 'org:acme',
});
```

Both calls are idempotent. Parent scopes and access grants you add to `structure` later are applied on the next `reconcile()`. A scope created by `materializeScope()` keeps the access it was created with, even if you later change its scope type.

Read the reconciled scopes back with the Knowledge store's `listScopeNodes()`. Pass `withinAddress` to read one scope and everything beneath it, or `addresses` for exact scopes, and follow `nextCursor` for more pages, so one tenant's read never depends on how many scopes other tenants have.

```ts
const store = await storage.getStore('knowledge');

let cursor: string | undefined;
do {
  const page = await store.listScopeNodes({ withinAddress: 'org:acme', cursor });
  for (const scope of page.scopes) console.log(scope.address, scope.parentIds);
  cursor = page.nextCursor ?? undefined;
} while (cursor);
```
