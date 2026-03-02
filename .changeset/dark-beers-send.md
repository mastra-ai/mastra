---
'mastracode': patch
---

Fixed parallel interactive tool calls (ask_user, request_sandbox_access) corrupting TUI input. When the agent fires multiple interactive tool calls simultaneously, they are now queued and shown one at a time instead of overwriting each other.
