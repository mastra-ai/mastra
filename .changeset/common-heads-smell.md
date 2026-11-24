---
'@mastra/playground-ui': minor
---

Added a stream view to the shared log viewer, for plain log lines such as sandbox and deploy output.

`LogsListView` takes `density="stream"` with an `order` of `newest-first` (the default, as in an audit log) or `oldest-first` (as in a terminal, opening on the newest line). Long lines wrap, and `onFetchNextPage` loads older logs when the older end scrolls into view. A log only needs `timestamp`, `level` and `message`; `data` shows as `key: value` fields after the message.

```tsx
<LogsListView
  density="stream"
  order="oldest-first"
  logs={lines}
  logIdMap={logIdMap}
  onLogClick={handleLogClick}
  hasNextPage={hasNextPage}
  onFetchNextPage={fetchNextPage}
/>
```

`LogsLevelToggles` shows and hides levels: click to toggle one, Cmd-click or Ctrl-click to show only that level, and turning off the last level shows them all again. `LogDataPanel` now groups a log into Details, Message and Fields sections, and `DataList` takes `density="compact"` for 24px rows and `variant="flush"` for rows that run edge to edge inside a surface the caller owns.
