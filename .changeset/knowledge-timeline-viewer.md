---
'@mastra/server': patch
'@mastra/client-js': patch
'@mastra/playground-ui': patch
---

Studio now shows a Knowledge timeline page's entries under the page: newest first with "Load older entries", a From/To date range, oldest-first order, one thread at a time ("Open thread"), and keyword search. Edited entries are marked and deleted ones show as "Deleted".

The server adds `GET /knowledge/:knowledgeKey/pages/:pageId/timeline` (`since`, `until`, `order`, `thread`, `cursor`, `limit`, or `q` for keyword matches), and a page read now says `timeline: true` for a timeline page. The client adds `knowledge.timeline(pageId, params)`.

```ts
const { entries, nextCursor } = await client.getKnowledge('main').timeline(pageId, {
  since: '2026-11-01T00:00:00Z',
  thread: '1700000000.000100',
});
```
