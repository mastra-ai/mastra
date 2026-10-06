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
