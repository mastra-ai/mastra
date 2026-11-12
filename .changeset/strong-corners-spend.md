---
'mastra': patch
---

`mastra dev` now waits for the whole server shutdown before it kills the server on a reload or Ctrl-C: the HTTP drain, the drain of in-flight workflow runs, and core teardown (twice `server.drainTimeout` plus 6.5 seconds, 16.5 seconds by default). Before, it killed the server after 5 seconds. That could cut off the end of the shutdown that records when the server stopped driving its evented runs, so after a reload, the runs it interrupted waited about 17 seconds before they continued, instead of about 2. A server that exits sooner is not waited for. A `server.drainTimeout` changed while `mastra dev` runs applies once `mastra dev` restarts.
