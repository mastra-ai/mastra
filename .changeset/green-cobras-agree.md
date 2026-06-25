---
'@mastra/playground-ui': minor
---

Added 'Total Time' column to the traces list view. Displays the duration (endedAt - startedAt) for each trace and supports client-side sorting by clicking the column header to quickly identify long-running traces.

```tsx
<TracesListView
  traces={traces}
  onTraceClick={handleClick}
  // Duration column is sortable by default; set false to disable
  sortableByDuration={true}
/>
```
