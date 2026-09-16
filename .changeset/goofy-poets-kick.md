---
'@mastra/mcp': minor
---

Added an `MCP_SERVER_REQUEST` root span for every request an `MCPServer` handles (`tools/list`, `tools/call`, `resources/*`, `prompts/*`, `logging/setLevel`) and for `executeTool()`. The span records the method, target, request params, response, server name and version, negotiated protocol version, and client name and version. Agents and workflows exposed as tools now nest under it, and a served tool no longer produces a separate root `TOOL_CALL` span:

```
MCP_SERVER_REQUEST  tools/call ask_supportAgent
└── AGENT_RUN       support-agent
    └── TOOL_CALL   lookupOrder
```

See https://github.com/mastra-ai/mastra/issues/23921
