---
'mastra': patch
'@mastra/deployer': patch
---

`mastra dev` now waits for the whole server shutdown before it kills the server on a reload or Ctrl-C: the HTTP drain, the drain of in-flight workflow runs, and core teardown (twice `server.drainTimeout` plus 6.5 seconds, 16.5 seconds by default). Before, it killed the server after 5 seconds. That could cut the shutdown off before it recorded that the server stopped driving its evented runs, so the reloaded server only restarted those runs once their liveness lapsed instead of about 2 seconds after the reload. A server that exits sooner is not waited for. A `server.drainTimeout` changed while `mastra dev` runs applies once `mastra dev` restarts.
