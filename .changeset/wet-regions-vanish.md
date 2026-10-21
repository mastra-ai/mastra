---
'@mastra/client-js': minor
---

Added saved views methods: `listSavedViews`, `getSavedView`, `createSavedView`, `updateSavedView` and `deleteSavedView`.

```ts
const view = await mastraClient.createSavedView({
  page: 'traces',
  name: 'Errors today',
  state: { version: 1, timeRange: { preset: 'last-24h' } },
});
const { views } = await mastraClient.listSavedViews({ page: 'traces' });
await mastraClient.updateSavedView(view.id, { name: 'Errors this week' });
```
