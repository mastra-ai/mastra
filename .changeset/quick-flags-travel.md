---
'@mastra/server': patch
'@mastra/client-js': patch
---

Fixed `tracingOptions.nestUnderParent` being dropped from agent and workflow requests sent over HTTP. A run started through `@mastra/client-js` with this option now stays a child of its parent run in the trace.
