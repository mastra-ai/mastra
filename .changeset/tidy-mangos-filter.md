---
'@mastra/mongodb': patch
---

`MongoDBVector` now pushes a metadata filter into the text search request instead of applying it after the search, so Atlas Search no longer scores and materialises keyword matches the filter would discard (#30360). `textQuery()` and the text branch of `hybridQuery()` emit the filter inside the `$search` stage when the text index can evaluate it, and keep today's post-`$search` `$match` for every filter it cannot.

The text index's own mapping decides what can be pushed down: a `dynamic` mapping covers any field, a field-mapped index covers the non-dotted fields it declares, and string values need a `token`-typed field. Operators are translated to their Atlas Search equivalents (`$eq`/`$ne` to `equals`, `$gt`/`$gte`/`$lt`/`$lte` to `range`, `$in`/`$nin` to `in`, `$exists` to `exists`, `$and`/`$or` to `compound`), and anything Atlas Search has no equivalent for — `$regex`, a `null` value, an empty `$in`, an undeclared or string-typed field — falls back to the `$match` path unchanged.

```ts
// The same call: the filter now runs inside the search request when the index can evaluate it
await store.textQuery({
  indexName: 'precedents',
  query: 'shell company',
  paths: ['note'],
  filter: { price: { $lt: 1500 } },
});
```
