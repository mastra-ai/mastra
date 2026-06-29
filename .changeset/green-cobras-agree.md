---
'@mastra/playground-ui': minor
---

Added 'Total Time' column to the traces list view. Displays the duration (endedAt - startedAt) for each trace and supports server-backed sorting by clicking the column header to quickly identify long-running traces. The traces page maps the list view's duration sort state to the storage `orderBy` option.

```tsx
<TracesListView
  traces={traces}
  onTraceClick={handleClick}
  durationSort={durationSort}
  onDurationSortChange={setDurationSort}
/>
```
