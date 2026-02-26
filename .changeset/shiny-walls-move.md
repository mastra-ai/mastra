---
'@mastra/blaxel': minor
---

Added background process management support via BlaxelProcessManager. Agents can now spawn, monitor, and kill long-running processes in Blaxel sandboxes using the standard ProcessHandle interface. Also fixed sandbox timeout detection for Blaxel's 404 responses, so retryOnDead correctly recovers expired sandboxes.
