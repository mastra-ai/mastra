---
'mastracode': patch
---

Quiet mode now trims every kind of chat entry, not just workspace tools. `execute_command` previously kept up to 15 lines of output in its terminal box while other tools collapsed to a single line; it now keeps the same box and shows the full command but no output. Notifications keep their bordered style but drop the priority/kind/status row and cap the message at the configured quiet preview line limit, and notification summaries drop the usage hint. Toggling quiet mode updates existing notifications live.
