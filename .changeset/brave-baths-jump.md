---
'mastracode': patch
---

Quiet mode now trims `execute_command` entries and notifications, which previously ignored it. `execute_command` kept up to 15 lines of output in its terminal box while other tools collapsed to a single line; it now keeps the same box and follows the quiet preview line limit like every other tool: the command is always shown (long commands are capped at the limit) and only the last N lines of output appear under it, with hidden lines noted by a `⋯ (+N lines)` marker. Setting the limit to None shows the command alone. Expanding tool output (ctrl+e) reveals the full command and output. Notifications keep their bordered style but drop the priority/kind/status row and cap the message at the quiet preview line limit, and notification summaries drop the usage hint. Toggling quiet mode updates existing notifications live.
