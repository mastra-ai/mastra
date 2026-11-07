---
'@mastra/core': minor
---

Knowledge storage can supply scope declarations, and access rules accept a `'*'` principal that gives its role to every run.

A store returns declarations, access rules included, from `getScopeDeclarations()` (none by default). Knowledge reads them at the start of every call and merges them under its config's: the config wins on a key both declare, and a declaration that doesn't compile is skipped with a warning. Runs list the root scopes `'*'` rules open after their own.

```ts
class ImportingKnowledgeStorage extends InMemoryKnowledgeStorage {
  override async getScopeDeclarations() {
    return {
      'linear:$account:$connection': { access: [{ principal: '*', role: 'viewer' }] },
    };
  }
}
```
