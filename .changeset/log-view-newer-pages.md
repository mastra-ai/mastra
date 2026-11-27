---
'@mastra/playground-ui': minor
---

`LogView.List` can page forward in time. Pass `nextPage="newer"` with `order="oldest-first"` for an API whose next page holds newer logs, such as a browser session's activity. The list opens on the oldest line at the top and loads the next page when the bottom scrolls into view, with a centered spinner there while it loads. The default, `nextPage="older"`, works as before.

```tsx
<LogView.List
  order="oldest-first"
  nextPage="newer"
  logs={lines}
  logIdMap={ids}
  hasNextPage={activity.hasNextPage}
  isFetchingNextPage={activity.isFetchingNextPage}
  onFetchNextPage={activity.fetchNextPage}
/>
```
