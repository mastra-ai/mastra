---
'mastracode': minor
---

Added background shells and background subagents to the TUI when experimental background tools are on.

- A background shell row shows the exit code when the process ends, and a `↳ Shell finished · <description> (exit N)` row appears in the chat.
- A background subagent box shows `◌ background` with its latest activity while it runs, then `✓ background`. When it ends, a `↳ Explore finished · <task>` row appears. Press Ctrl+E to expand it.
- Ctrl+G lists background shells next to background tasks, with how long each has run. Enter shows a shell's output or opens a subagent's box. D kills a shell or cancels a task.
