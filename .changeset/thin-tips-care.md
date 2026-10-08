---
'@mastra/pg': minor
---

Knowledge scope structure now works with PostgreSQL storage. `knowledge.reconcile()` and `knowledge.materializeScope()` save your declared scopes, and if a call fails partway, none of its changes are kept. A content node can have the same name as a scope; only scopes under the same parent need different names.

Reading scopes back with `listScopeNodes()` returns one page at a time and only the scopes you ask for, so reading one org stays fast however many scopes other orgs have:

```ts
const store = await storage.getStore('knowledge');
const { scopes, nextCursor } = await store.listScopeNodes({ withinAddress: 'org:acme', limit: 100 });
```
