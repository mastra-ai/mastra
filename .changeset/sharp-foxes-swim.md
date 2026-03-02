---
'@mastra/daytona': minor
---

Added PTY-based reconnection to the Daytona process manager. The baseline process manager can now discover and reconnect to externally-spawned PTY sessions via `list()` and `get()`, enabling visibility into processes not originally spawned through Mastra.
