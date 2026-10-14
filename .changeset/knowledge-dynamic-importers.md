---
'@mastra/core': minor
---

Knowledge importers can now be resolved dynamically. `importers` in the Knowledge config accepts either an array or a resolver function that is re-evaluated on each importer scheduling tick, and cron triggers accept `resolveBindings` to compute their bindings each time they fire.

Resolved bindings are confined to the importer's `access` map: a destination the map does not cover is skipped with a warning, and an importer that uses `resolveBindings` must declare `access`. If a resolution fails, that fire uses the static `bindings` only and the next fire retries.

```ts
const knowledge = new Knowledge({
  importers: async () => loadImportersForTenant(),
});
```
