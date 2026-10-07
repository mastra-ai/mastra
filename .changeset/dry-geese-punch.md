---
'@mastra/mongodb': minor
---

`MongoDBVector` takes an `autoEmbed` config in its constructor and reports itself as a self-embedding store, so `Memory`'s semantic recall can use Automated Embedding with no client-side embedder.

```ts
new MongoDBVector({ id: 'vec', uri, dbName, autoEmbed: { model: 'voyage-4' } });
```

A `createIndex` call naming neither its own `autoEmbed` config nor a `dimension` picks up those defaults; naming either one overrides them, so one store can hold both kinds of index.
