---
'mastra': patch
---

`mastra start` now forwards SIGINT/SIGTERM to the server and waits for it to exit instead of exiting immediately. Exiting right away left the server running as an orphan during its graceful shutdown, so in-flight requests were never drained and the server's exit code was lost.
