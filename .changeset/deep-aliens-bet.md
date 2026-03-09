---
'@mastra/core': patch
'@mastra/mcp': patch
---

Reduced token usage when workflows are used as agent tools. Workflow execution results sent to the model now only include essential fields (status, result, error) instead of the full verbose execution log with all intermediate step inputs and outputs. This optimization applies to both direct agent tool usage and MCP server workflow tools.
