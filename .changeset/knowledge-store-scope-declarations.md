---
'@mastra/core': minor
---

Knowledge storage can now supply scope declarations. A store returns them, access rules included, from `getScopeDeclarations()` (none by default), for example the scopes a hosted store's importers write to. Knowledge reads them at the start of every call and merges them under its config's, so a declaration the store adds or changes applies from the next call, with no restart; a key the config declares keeps the config's declaration, and a store declaration that doesn't compile is skipped with a warning. Stored scopes under store-declared keys pass the declaration check.

Access rules take a new principal, `'*'`, that gives its role to every run whatever it holds. Runs list the root scopes `'*'` rules open after their own at the root of `knowledge_list` and `knowledge_read`.

```ts
const scopes = {
  'policy:$name': { access: [{ principal: '*', role: 'viewer' }] },
};
```
