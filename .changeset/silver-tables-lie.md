---
'@mastra/client-js': patch
---

Added landmark support to trace signal theme snapshot types: an optional `presentation: 'landmarks'` request option, a per-snapshot selection `reason`, a `cutoffAt` timestamp for time-axis placement, and a top-level `totalSnapshots` count returned when the theme-snapshots endpoint is queried in landmarks mode.
