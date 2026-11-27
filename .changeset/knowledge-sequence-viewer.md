---
'@mastra/server': patch
'@mastra/client-js': patch
'@mastra/playground-ui': patch
---

Studio now shows a Knowledge sequence page's items under the page, in the sequence's own order: newest first on a timeline, first position first on a position sequence, with "Load more items" and a toggle to reverse it. Each item shows its author, time, type, title, body, links and properties, with the properties its schema declares first. A child page listed as an item opens when you click its title. You can narrow the list to a From/To date range (timeline sequences only), one item and the items nested under it ("Show nested items"), one declared type or untyped items, or search it by keyword. Edited items are marked and deleted ones show as "Deleted".

The server adds `GET /knowledge/:knowledgeKey/pages/:pageId/sequence` (`since`, `until`, `order`, `parent`, `type`, `untyped`, `cursor`, `limit`, or `q` for keyword matches). It refuses a date range or a timeline cursor on a position sequence with a 400. A page read of a sequence page now returns `sequence` with its `orderBy`, `propertiesSchema` and `itemTypes`. The client adds `knowledge.sequence(pageId, params)`.

```ts
const { items, nextCursor } = await client.getKnowledge('main').sequence(pageId, {
  parent: '1700000000.000100',
  types: ['deploy'],
});
```
