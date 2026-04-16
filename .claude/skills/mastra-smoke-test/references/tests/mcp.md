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
