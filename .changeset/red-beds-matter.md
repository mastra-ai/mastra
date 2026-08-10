---
'mastracode': minor
---

Added the ability to disable MCP servers without editing configuration files.

- **Disable and enable servers**: Run `/mcp disable <server-name|all>` to turn servers off and `/mcp enable <server-name|all>` to turn them back on, or toggle individual servers from the interactive `/mcp` selector.
- **Global scope**: Add `--global` to apply the change to every project. `/mcp disable all --global` acts as a kill switch for all MCP servers.
- **Persistence**: Disabled servers stay visible in `/mcp status` with a marker for the scope that disabled them, their tools are removed from the agent, and the state survives restarts.
