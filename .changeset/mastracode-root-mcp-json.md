---
'mastracode': patch
---

Read MCP server config from a project root `.mcp.json` (the file Claude Code uses). Projects that already keep their MCP servers there no longer need a duplicate under `.mastracode/`. The root file sits below `.mastracode/mcp.json` in priority, so project-specific config still wins.
