---
'mastracode': minor
---

Added a `/reload` command that reloads plugins, skills, custom slash commands, hooks, and MCP servers without restarting the session. Changes you make on disk, like a new skill or an edited hooks.json, are picked up right away, and anything that fails to reload is reported.
