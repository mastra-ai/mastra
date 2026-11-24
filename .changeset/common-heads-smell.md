---
'@mastra/playground-ui': minor
---

Added a stream view to the shared log viewer, for plain log lines such as sandbox and deploy output.

`LogsListView` takes `density="stream"`: oldest line at the top, newest at the bottom, long lines wrap, and a "Load older logs" button sits above the list through `onFetchNextPage`. A log only needs `timestamp`, `level` and `message`; `data` shows as `key: value` fields after the message.

```tsx
<LogsListView
  density="stream"
  logs={lines}
  logIdMap={logIdMap}
  onLogClick={handleLogClick}
  hasNextPage={hasNextPage}
  onFetchNextPage={fetchNextPage}
/>
```

`LogsLevelToggles` shows and hides levels: click to toggle one, Cmd-click or Ctrl-click to show only that level, and turning off the last level shows them all again. `LogDataPanel` now groups a log into Details, Message and Fields sections, and `DataList` takes `density="compact"` for 24px rows.
