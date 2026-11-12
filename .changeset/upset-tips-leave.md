---
'mastracode': minor
---

Added background shells and background subagents to the TUI when experimental background tools are on.

- A background shell row shows the exit code when the process ends, and a `↳ Shell finished · <description> (exit N)` row appears in the chat.
- A background subagent box shows `◌ background` with its latest activity while it runs, then `✓ background`. When it ends, a `↳ Explore finished · <task>` row appears. The finished box is compact unless Ctrl+E has expanded tool output.
- Completion rows for other background tasks changed from `<tool> completed in background` to `↳ <tool> finished`.
- Ctrl+G lists background shells next to background tasks, with how long each has run. Enter shows a shell's output or expands or collapses a subagent's box. D kills a shell or cancels a task.
