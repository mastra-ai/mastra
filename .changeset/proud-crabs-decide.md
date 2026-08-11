---
'@mastra/code-sdk': minor
---

Added MCP disable-state controls to the MCP manager. Servers can be disabled for the current project or for every project, the state persists across runs in an app-data `mcp-state.json` (user MCP config files are never mutated), and disabled servers stay visible in statuses via the new `disabled`/`disabledScope` fields on `McpServerStatus`.

```ts
await mcpManager.setServerDisabled('filesystem', true); // project scope
await mcpManager.setServerDisabled('filesystem', true, { global: true }); // all projects
await mcpManager.setAllDisabled(true, { global: true }); // global kill switch
mcpManager.isAllDisabledGlobally();
mcpManager.getDisabledServers();
```
