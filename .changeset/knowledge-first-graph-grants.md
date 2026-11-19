---
'@mastra/core': patch
'@mastra/server': patch
---

Studio's Knowledge graph and explorer now show grants and scope labels from store-supplied declarations (e.g. Platform Knowledge) on the first request, not only after another call loaded them. Adds `Knowledge.resolveScopeDeclarations()`.

The synchronous readers `scopeGrants()`, `scopeDeclaration()` and `scopeLabel()` use the declarations as last read, so resolve them first:

```ts
const knowledge = mastra.getKnowledge('default');
await knowledge.resolveScopeDeclarations();
knowledge.scopeLabel('org:acme');
```
