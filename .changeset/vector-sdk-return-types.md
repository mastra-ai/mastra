---
'@mastra/client-js': minor
---

Fixed Vector resource return types so they match what the server actually returns. Previously the types declared shapes that did not exist at runtime, leading to runtime failures with no TypeScript errors.

**What changed**

- `vector.getIndexes()` now returns `string[]` (was `{ indexes: string[] }`)
- `vector.upsert()` now returns `{ ids: string[] }` (was `string[]`)
- `vector.query()` now returns `QueryResult[]` (was `{ results: QueryResult[] }`)

**Before**

```ts
const response = await client.getVector('docs').getIndexes();
console.log(response.indexes); // undefined at runtime
```

**After**

```ts
const indexes = await client.getVector('docs').getIndexes();
console.log(indexes[0]); // 'docs-index'
```

Closes #15089.
