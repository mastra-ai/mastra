---
'@mastra/core': patch
'@mastra/server': patch
---

Each page in a Knowledge tree level (`GET /api/knowledge/:knowledgeKey/tree`, `listKnowledgeTreeChildren`) now carries `childCount`: how many readable pages, and for a scope how many readable child scopes, sit directly under it. A browsing UI can show the count and offer to open only pages that have children. The count is left out when the storage adapter can't count children yet.

```ts
const level = await client.getKnowledge('main').tree({ parentId: scopeId });
level.pages.map(page => `${page.name} (${page.childCount ?? '?'})`);
```

Storage adapters gain `countChildPages({ parentIds, read })`, which counts a batch of parents' child pages in one query (in-memory, LibSQL, PostgreSQL, MySQL, MongoDB).
