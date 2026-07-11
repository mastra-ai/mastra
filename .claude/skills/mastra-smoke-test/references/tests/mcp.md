# MCP Servers Testing (`--test mcp`)

## Purpose

Verify MCP (Model Context Protocol) servers page loads and connections work.

## Steps

### 1. Navigate to MCP Page

- [ ] Open `/mcps` in Studio
- [ ] Note if page loads and any errors displayed
- [ ] Record what MCP servers list shows

### 2. Observe Empty State

If no MCP servers configured:

- [ ] Record the empty state message shown
- [ ] Note any errors displayed
- [ ] Record if instructions for adding servers appear

### 3. Observe Configured Servers

If MCP servers are configured:

- [ ] Record which servers appear in list
- [ ] Note connection status shown (connected/disconnected)
- [ ] Record server names and types visible

### 4. Test Server Connection

For each configured server:

- [ ] Record connection status
- [ ] Note available tools from server
- [ ] Record which tools are discoverable

### 5. Test MCP Tool (if available)

- [ ] Navigate to `/tools`
- [ ] Find MCP-provided tool
- [ ] Execute tool
- [ ] Record the result and whether it calls external server

## Observations to Report

| Check       | What to Record                   |
| ----------- | -------------------------------- |
| MCP page    | Load behavior, any errors        |
| Empty state | Message content if no servers    |
| Server list | Servers shown and their details  |
| Connection  | Status indicator behavior        |
| Tools       | Which MCP tools are discoverable |

## MCP Configuration

Servers are typically configured in project code:

```typescript
import { MCPConfiguration } from '@mastra/core/mcp';

const mcp = new MCPConfiguration({
  servers: {
    myServer: {
      command: 'node',
      args: ['path/to/server.js'],
    },
  },
});
```

## Common Issues

| Issue               | Cause                     | Fix                         |
| ------------------- | ------------------------- | --------------------------- |
| Page error          | MCP not supported         | Check Mastra version        |
| Server disconnected | Server process failed     | Check server logs           |
| No tools            | Server not exposing tools | Check server implementation |

## Notes

- MCP is optional - empty state is acceptable
- External MCP servers may require separate processes
- Connection issues may be transient

## Browser Actions

```
Navigate to: /mcps
Wait: For page to load
Verify: Page loads without errors
Verify: Server list OR empty state visible

# If servers configured:
Click: On server in list
Verify: Connection status shown
Verify: Available tools listed
```

## Curl / API (for `--skip-browser`)

The server exposes MCP endpoints under `/api/mcp/v0/...` (not `/api/mcps`
— that's the Studio route). The `MCP` here refers to Mastra hosting MCP
servers for external clients; it does not list external MCP clients the
project consumes.

**1. List MCP servers this Mastra instance exposes**

```bash
curl -s "http://localhost:4111/api/mcp/v0/servers" | jq '.'
```

Response shape: `{ servers: [...], total_count: N, next: null }`. An
empty array is a valid pass if the project declares no MCP servers (the
default `create-mastra` template does not).

**2. Get one server's metadata**

```bash
curl -s "http://localhost:4111/api/mcp/v0/servers/<serverId>" | jq '.'
```

**3. List tools a server exposes, and execute one**

```bash
# List tools
curl -s "http://localhost:4111/api/mcp/<serverId>/tools" | jq '.'

# Inspect one tool
curl -s "http://localhost:4111/api/mcp/<serverId>/tools/<toolId>" | jq '.'

# Execute the tool
curl -s -X POST "http://localhost:4111/api/mcp/<serverId>/tools/<toolId>/execute" \
  -H "Content-Type: application/json" \
  -d '{"data":{ ... }}'
```

**Pass criteria:**

- `GET /api/mcp/v0/servers` returns HTTP 200 with the expected shape
  (empty `servers` array is OK)
- If servers are declared: each shows up in the list and
  `GET /api/mcp/v0/servers/:id` returns a non-null object
- If tools are exposed: `GET /api/mcp/:serverId/tools` lists them and
  `POST /.../execute` returns a successful result

**Common mistakes:**

- Hitting `/api/mcps` or `/api/mcp/servers` — neither exists server-side
- Treating an empty `servers` list as failure on the default template —
  it's expected
