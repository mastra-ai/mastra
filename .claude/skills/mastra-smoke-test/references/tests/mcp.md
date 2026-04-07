# MCP Servers Testing (`--test mcp`)

## Purpose
Verify MCP (Model Context Protocol) servers page loads and connections work.

## Steps

### 1. Navigate to MCP Page
- [ ] Open `/mcps` in Studio
- [ ] Verify page loads without errors
- [ ] Check for MCP servers list

### 2. Verify Empty State
If no MCP servers configured:
- [ ] Page shows empty state message
- [ ] No errors displayed
- [ ] Instructions for adding servers may be shown

### 3. Verify Configured Servers
If MCP servers are configured:
- [ ] Servers appear in list
- [ ] Connection status shown (connected/disconnected)
- [ ] Server name and type visible

### 4. Test Server Connection
For each configured server:
- [ ] Verify connection status
- [ ] Check available tools from server
- [ ] Confirm tools are discoverable

### 5. Test MCP Tool (if available)
- [ ] Navigate to `/tools`
- [ ] Find MCP-provided tool
- [ ] Execute tool
- [ ] Verify it calls external server

## Expected Results

| Check | Expected |
|-------|----------|
| MCP page | Loads without errors |
| Empty state | Clean message if no servers |
| Server list | Shows configured servers |
| Connection | Status indicator works |
| Tools | MCP tools discoverable |

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

| Issue | Cause | Fix |
|-------|-------|-----|
| Page error | MCP not supported | Check Mastra version |
| Server disconnected | Server process failed | Check server logs |
| No tools | Server not exposing tools | Check server implementation |

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
