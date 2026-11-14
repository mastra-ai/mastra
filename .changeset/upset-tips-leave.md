---
'mastracode': minor
---

Added background shells to the TUI when experimental background tools are on.

- A background shell row shows the exit code when the process ends, and a `↳ Shell finished · <description> (exit N)` row appears in the chat.
- Ctrl+G lists background shells next to background tasks, with how long each has run. Enter shows a shell's output, and D kills it.
