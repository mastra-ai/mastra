---
'@mastra/core': minor
---

Knowledge storage can supply scope declarations, access rules included.

A store returns declarations from `getScopeDeclarations()` (none by default). Knowledge reads them at the start of every call and merges them under its config's: the config wins on a key both declare, and a declaration that doesn't compile is skipped with a warning.

```ts
class ImportingKnowledgeStorage extends InMemoryKnowledgeStorage {
  override async getScopeDeclarations() {
    return {
      'imports:$name': {},
      'linear:$account:$connection': { access: [{ principal: 'imports:all', role: 'viewer' }] },
    };
  }
}
```

Runs that hold `imports:all` then read every Linear connection's pages.
