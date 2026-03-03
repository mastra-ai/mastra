---
'mastracode': minor
---

Support HTTP MCP servers in mastracode config

MCP server entries with a `url` field are now recognized as HTTP (Streamable HTTP / SSE) servers. Previously only stdio-based servers (with `command`) were loaded from `mcp.json`; entries with `url` were silently dropped.

**What's new:**
- Add `url` + optional `headers` config for HTTP MCP servers
- Invalid or ambiguous entries are tracked as "skipped" with a human-readable reason
- `/mcp` command shows transport type (`[stdio]` / `[http]`) and lists skipped servers
- Startup logs report skipped servers with reasons

**Example mcp.json:**
```json
{
  "mcpServers": {
    "local-fs": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path"]
    },
    "remote-api": {
      "url": "https://mcp.example.com/sse",
      "headers": { "Authorization": "Bearer <token>" }
    }
  }
}
```
