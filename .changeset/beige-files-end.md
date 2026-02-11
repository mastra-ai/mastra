---
'@mastra/playground-ui': patch
'@mastra/client-js': patch
'@mastra/memory': patch
'@mastra/server': patch
'@mastra/mongodb': patch
'@mastra/core': patch
'@mastra/libsql': patch
'@mastra/pg': patch
---

Fixed observational memory progress bars resetting to zero after agent responses finish. The messages and observations sidebar bars now retain their values on stream completion, cancellation, and page reload. Also added a buffer-status endpoint so buffering badges resolve with accurate token counts instead of spinning forever when buffering outlives the stream.
