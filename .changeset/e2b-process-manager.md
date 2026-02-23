---
'@mastra/e2b': minor
---

Added `E2BProcessManager` for background process management in E2B cloud sandboxes.

Wraps E2B SDK's `commands.run()` with `background: true` and `commands.connect()` for reconnection. Processes spawned in E2B sandboxes are automatically cleaned up on `stop()` and `destroy()`.

Bumps `@mastra/core` peer dependency to `>=1.7.0-0` (requires `SandboxProcessManager` from core).
