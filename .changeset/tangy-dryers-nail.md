---
'@mastra/core': minor
---

Added optional `log` and `progress` functions to the MCP tool execution context type so tools running in an MCP server can send log and progress notifications to the calling client.

Added `mastra.removeTool(key)` to remove a dynamically registered tool from the Mastra instance, the counterpart to `mastra.addTool()`:

```typescript
mastra.addTool(calculatorTool);
mastra.removeTool('calculator-tool'); // returns true if a tool was removed
```
