---
'@mastra/core': minor
---

Knowledge storage can supply scope declarations, access rules included.

A store returns declarations from `getScopeDeclarations()` (none by default). Knowledge merges them under its config's: the config wins on a key both declare, and a declaration that doesn't compile is skipped with a warning. The store's answer is reused for 30 seconds and read again after `renameScopeDeclaration`, so a declaration the store adds, removes or changes (access rules included) applies within that window without a store read on every call. Revoking access through the store can therefore take up to 30 seconds to take effect.

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
