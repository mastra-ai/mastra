---
'@mastra/playground-ui': minor
---

Added `LogView`, a shared log viewer for plain log lines such as sandbox and deploy output. It is built from parts, so a page keeps only what it needs and fetches its own data.

```tsx
<LogView>
  <LogView.Header>
    <LogView.Title />
    <LogView.LevelToggles levels={levels} value={shown} onValueChange={setShown} />
    <LogView.Filters logs={logs} value={filters} onValueChange={setFilters} fieldChips={false} />
    <LogView.Refresh onRefresh={refetch} refreshing={isFetching} />
  </LogView.Header>
  <LogView.List
    logs={lines}
    logIdMap={logIdMap}
    order="oldest-first"
    wrap={false}
    hasNextPage={hasNextPage}
    onFetchNextPage={fetchNextPage}
    onLogClick={openLog}
  />
</LogView>
```

`LogView.List` shows time, level and message with a level bar and a red tint on errors. JSON messages show as fields and stack traces collapse to three lines. `order` is `oldest-first` (terminal) or `newest-first` (audit log), older logs load when that end scrolls into view, `wrap={false}` keeps each line on one row and scrolls sideways, and leaving out `onLogClick` makes lines read-only. `LogView.Filters` offers search and chips for any log field; turn either off with `search={false}` or `fieldChips={false}`, or leave the part out. `filterLogsByFields` and `logViewSearchText` apply the chips.

`LogView.List` is built on the new `LogStream` component (`@mastra/playground-ui/components/LogStream`): an outlined, sunken log list with 24px rows, a Time, Level and Message header, a level bar and error tint per line, and clickable or read-only rows. Use it directly for a custom log list. `LogDataPanel` now groups a log into Details, Message and Fields sections and pretty-prints JSON and nested metadata.
