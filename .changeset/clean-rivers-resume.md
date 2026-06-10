---
'@mastra/server': patch
'@mastra/client-js': patch
'mastra': patch
---

Fixed resuming workflow steps through the remote step-execution endpoint when the resume data is falsy (`false`, `0`, `null`, `""`). Remote execution now correctly handles falsy resume data, matching local resume behavior.
