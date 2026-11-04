---
'@mastra/client-js': minor
---

Added `client.getKnowledgeImporters()` for servers that host Knowledge importers. It lists importers and their connections, saves per-importer settings, previews runs, starts imports, and reads run history and live run logs.

```ts
const importers = client.getKnowledgeImporters();
const { summaries } = await importers.list();
await importers.run(summaries[0].key);
```
