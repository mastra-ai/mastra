---
'@mastra/server': patch
'@mastra/client-js': patch
'@mastra/playground-ui': patch
---

Studio now shows a Knowledge sequence page's items under the page: newest first with "Load older items", a From/To date range, oldest-first order, one thread at a time ("Open thread"), and keyword search. Edited items are marked and deleted ones show as "Deleted".

The server adds `GET /knowledge/:knowledgeKey/pages/:pageId/sequence` (`since`, `until`, `order`, `thread`, `cursor`, `limit`, or `q` for keyword matches), and a page read now says `sequence: true` for a sequence page. The client adds `knowledge.sequence(pageId, params)`.

```ts
const { items, nextCursor } = await client.getKnowledge('main').sequence(pageId, {
  since: '2026-11-01T00:00:00Z',
  thread: '1700000000.000100',
});
```
