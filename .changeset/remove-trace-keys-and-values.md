---
'@mastra/playground-ui': minor
---

The trace summary now shows the trace status (Success, Running or Error), and `TraceDataPanelView` shows that summary on the trace page too, not only in the side panel. This replaces `TraceKeysAndValues`, which is removed.

Breaking:

- `TraceKeysAndValues` and `TraceKeysAndValuesProps` are removed. On a trace page, drop it from `headerSlot`; `TraceDataPanelView` with `placement="trace-page"` now renders entity, status, start time, duration and usage itself.
- `DataKeysAndValues` no longer takes `numOfCol` and always renders a single key/value column. Drop the prop; for side-by-side groups, render several lists in your own grid.
