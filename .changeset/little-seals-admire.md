---
'@mastra/server': patch
---

MCP server listings and details now report which transports a server offers (`streamable-http`, plus `sse` for MCP 1.x servers), so clients can tell MCP v2 servers apart without probing routes. The `transports` field is optional on the response types so clients keep working against older servers that do not send it. The MCP tool info response type also declares the optional `id` that MCP v2 servers include.

```bash
curl http://localhost:4111/api/mcp/v0/servers
# { "servers": [{ "id": "notes", "name": "notes", "version_detail": { ... }, "transports": ["streamable-http"] }], ... }
```
