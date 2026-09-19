---
'mastracode': patch
---

Quiet mode now trims `execute_command` entries and notifications, which previously ignored it. `execute_command` kept up to 15 lines of output in its terminal box while other tools collapsed to a single line; it now keeps the same box and shows the command only, with commands longer than the quiet preview line limit capped and followed by a `⋯ (+N lines)` marker. Notifications keep their bordered style but drop the priority/kind/status row and cap the message at the quiet preview line limit, and notification summaries drop the usage hint. Toggling quiet mode updates existing notifications live.
