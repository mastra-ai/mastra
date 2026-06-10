---
'@mastra/core': patch
'mastracode': patch
---

Fixed HarnessCompat signal delivery so active build-mode interjections preserve V1 signal delivery options, active-run routing follows the V1 session run state instead of stale adapter display state, idle signal runs own their stream/progress lifecycle, real V1 data-part stream chunks render assistant text/tool/shell output, and new threads preserve the selected mode/model without reloading an empty thread over the first response.
