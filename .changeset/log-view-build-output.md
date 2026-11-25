---
'@mastra/playground-ui': minor
---

`LogView` and `LogStream` now show deploy and build output as well as structured logs.

- A line needs only a `message`. Lines without a time or level keep their columns, with a neutral bar.
- Terminal color and bold codes render with theme colors; other escape codes are dropped.
- An optional `icon` (`{ element, label }`) puts a muted icon before the message, such as build or runtime, named on hover and for screen readers.
- `LogView.List` takes a `ref` with `scrollToLog(id)`, to bring a line such as a deploy error into view.
- `LogView.Count` and `LogView.Copy` show the line count and copy every line, grouped with `LogView.Refresh` in `LogView.Actions`.
- `height="fill"` makes the panel fill its container.
- Hovering a log time shows it in your zone and in UTC, styled like `RelativeTimestamp`. `timeFractionDigits` sets how many digits follow the seconds (2 by default).

`formatTimestampPrecise` takes `fractionDigits` and `timeZone`.

```tsx
<LogView height="fill">
  <LogView.Header>
    <LogView.Title>Build logs</LogView.Title>
    <LogView.Actions>
      <LogView.Count count={lines.length} />
      <LogView.Copy content={raw} />
    </LogView.Actions>
  </LogView.Header>
  <LogView.List ref={list} logs={lines} logIdMap={ids} order="oldest-first" />
</LogView>
```
