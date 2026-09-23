---
'@mastra/playground-ui': minor
---

Removed `TraceKeysAndValues` and the `numOfCol` prop of `DataKeysAndValues`.

Breaking:

- `TraceKeysAndValues` and `TraceKeysAndValuesProps` are removed. Studio's trace panel has shown `TraceSummaryDescription` instead since the trace panel header redesign; use it for the same root-span summary.
- `DataKeysAndValues` no longer takes `numOfCol` and always renders a single key/value column. Drop the prop; for side-by-side groups, render several lists in your own grid.
