---
'@mastra/core': patch
'@mastra/server': patch
'@mastra/client-js': patch
'mastra': patch
---

Reduced workflow snapshot sizes during suspended agent runs, preserved explicit false, zero, null, and empty-string resume payloads, and kept worker step execution resume state aligned across local and remote execution.
