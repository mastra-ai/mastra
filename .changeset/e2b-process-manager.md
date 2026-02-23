---
'@mastra/e2b': minor
---

Added `E2BProcessManager` for background process management in E2B cloud sandboxes.

Wraps E2B SDK's `commands.run()` with `background: true` and `commands.connect()` for reconnection. Processes spawned in E2B sandboxes are automatically cleaned up on `stop()` and `destroy()`.
