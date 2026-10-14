---
'@mastra/core': minor
---

Workspace search now works with a vector store that generates embeddings itself, so no `embedder` is needed.

With MongoDB Automated Embedding, MongoDB embeds each file when it is indexed and the search string when you query:

```ts
const workspace = new Workspace({
  filesystem: new LocalFilesystem({ basePath: './workspace' }),
  vectorStore: new MongoDBVector({ id: 'search', uri, dbName, autoEmbed: { model: 'voyage-4' } }),
});

await workspace.rebuildSearchIndex(['docs']);
await workspace.search('how do I reset a password?');
```

The index is named `<workspace id>_search_selfembed` unless you set `searchIndexName`. Workspaces that pass an `embedder` keep working unchanged.
