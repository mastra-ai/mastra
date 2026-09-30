---
'mastracode': patch
---

Fixed Mastra Code leaving its signal socket files under `/tmp/mc` behind on exit. Shutdown now closes the signals connection, so other running instances take over cleanly instead of recovering from stale sockets.
