---
'@mastra/playground-ui': minor
---

The trace summary now shows the trace status (Success, Running or Error), and `TraceDataPanelView` shows that summary on the trace page too, not only in the side panel. This replaces `TraceKeysAndValues`, which is removed.

**Breaking changes:**

- `TraceKeysAndValues` and `TraceKeysAndValuesProps` are removed. `TraceDataPanelView` with `placement="trace-page"` now renders entity, status, start time, duration and usage itself, so drop it from `headerSlot`:

  ```tsx
  // Before
  <TraceDataPanelView
    placement="trace-page"
    headerSlot={<TraceKeysAndValues rootSpan={rootSpan} numOfCol={3} />}
    {...props}
  />

  // After
  <TraceDataPanelView placement="trace-page" {...props} />
  ```

- `DataKeysAndValues` no longer takes `numOfCol` and always renders a single key/value column. For side-by-side groups, render several lists in your own grid:

  ```tsx
  // Before
  <DataKeysAndValues numOfCol={2}>{rows}</DataKeysAndValues>

  // After
  <div className="grid grid-cols-2 gap-x-4">
    <DataKeysAndValues>{firstRows}</DataKeysAndValues>
    <DataKeysAndValues>{secondRows}</DataKeysAndValues>
  </div>
  ```
