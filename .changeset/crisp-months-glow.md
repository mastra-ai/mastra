---
'@mastra/core': minor
---

Added a `savedViews` storage domain. A saved view is a named setup for a Studio page, such as the filters, time range, sort and columns of the Traces page. Views are shared: everyone who can open Studio sees every view, `authorId` records who created a view and `updatedById` who last changed it. `resourceId` holds the tenant when the server scopes stored resources. `InMemoryStore` includes the domain, and storage adapters can implement `SavedViewsStorage`.

```ts
const savedViews = await mastra.getStorage()?.getStore('savedViews');

const view = await savedViews?.create({
  page: 'traces',
  name: 'Errors today',
  authorId: 'user-1',
  state: { version: 1, filters: [], settings: { datePreset: 'last-24h' } },
});

await savedViews?.update(view!.id, { name: 'Errors this week', updatedById: 'user-2' });
const { views, pagination } = await savedViews!.list({ page: 'traces', pagination: { page: 0, perPage: 100 } });
```
