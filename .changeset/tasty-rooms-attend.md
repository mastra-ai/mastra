---
'@mastra/playground-ui': patch
---

Changed the default Observability list mode to branches (all traces, including nested). Removed the list-mode toggle from the local studio UI; the query logic still recognizes `?listMode=traces` to opt back into the top-level-only view.

**Before**

`/observability` → top-level traces only

**After**

`/observability` → branches (all traces, nested too)
`/observability?listMode=traces` → top-level traces only
