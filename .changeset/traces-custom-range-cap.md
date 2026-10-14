---
'@mastra/playground-ui': patch
---

Studio traces: the custom date picker now rejects ranges longer than 31 days instead of sending a query the server refuses, the error screen shows the server's reason instead of a generic message, and auto refresh stops retrying a rejected range so the page no longer flickers between the list and the error.
