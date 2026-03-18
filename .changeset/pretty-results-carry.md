---
'mastracode': minor
---

Improved MCP server management with interactive `/mcp` selector UI.

- **Fixed stderr flooding** — MCP child process debug output no longer corrupts the terminal. Server stderr is piped and buffered instead of inherited.
- **Fixed console.info race condition** — MCP status messages now display properly in the chat area instead of racing with TUI rendering.
- **Better error detection** — Failed MCP servers now correctly show as failed instead of showing as connected with 0 tools.
- **Interactive `/mcp` command** — Replaces text-only output with a navigable overlay (↑↓ to select, Enter for actions, Esc to close). Sub-menus offer View tools, View error, View logs, and Reconnect per server.
- **Per-server reconnect** — Reconnect individual servers from the `/mcp` selector without restarting all connections.
- **Live status polling** — The `/mcp` selector auto-refreshes while servers are still connecting.
- **Connecting state** — Servers show as 'connecting...' during initial startup, visible via `/mcp`.

**Example**
```text
/mcp
```
