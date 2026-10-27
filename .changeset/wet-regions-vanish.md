---
'@mastra/client-js': minor
---

Added saved views methods: `listSavedViews`, `getSavedView`, `createSavedView`, `updateSavedView` and `deleteSavedView`. `listSavedViews` returns up to 100 views per call; pass `pageIndex` to get the next page while `pagination.hasMore` is `true`.

```ts
const view = await mastraClient.createSavedView({
  page: 'traces',
  name: 'Errors today',
  state: { version: 1, filters: [], settings: { datePreset: 'last-24h' } },
});
const { views, pagination } = await mastraClient.listSavedViews({ page: 'traces' });
await mastraClient.updateSavedView(view.id, { name: 'Errors this week' });
await mastraClient.deleteSavedView(view.id); // { deleted: true }
```
