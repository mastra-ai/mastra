---
'mastra': patch
---

Fixed `mastra dev` to exit cleanly when Ctrl+C is pressed. Previously, mashing Ctrl+C could print a `MaxListenersExceededWarning` in the terminal, and in some cases the CLI would freeze after showing "Dev server stopped" — leaving users to escape with Ctrl+Z. The shutdown is now idempotent and falls back to a 3s force-exit if cleanup stalls. Fixes #15446.
