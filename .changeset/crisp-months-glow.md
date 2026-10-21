---
'@mastra/core': minor
---

Added a `savedViews` storage domain. A saved view is a named setup for a Studio page, such as the filters, time range, sort and columns of the Traces page. Everyone who can open Studio sees every view; `authorId` only records who created it. `InMemoryStore` includes the domain, and storage adapters can implement `SavedViewsStorage`.

```ts
const savedViews = await mastra.getStorage()?.getStore('savedViews');

const view = await savedViews?.create({
  page: 'traces',
  name: 'Errors today',
  state: { version: 1, timeRange: { preset: 'last-24h' }, sort: { field: 'startedAt', direction: 'desc' } },
});

const { views } = await savedViews!.list({ page: 'traces' });
```
