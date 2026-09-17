---
'@mastra/mcp': minor
---

Added an `MCP_SERVER_REQUEST` root span for every request an `MCPServer` handles (`tools/list`, `tools/call`, `resources/*`, `prompts/*`, `logging/setLevel`) and for `executeTool()`. The span records the method, target, request params, response, server name and version, negotiated protocol version, and client name and version.

Register the server on a Mastra instance that has observability configured and served requests are traced, with no extra setup:

```ts
import { Mastra } from '@mastra/core/mastra';
import { MCPServer } from '@mastra/mcp';
import { Observability } from '@mastra/observability';

export const mastra = new Mastra({
  mcpServers: {
    orderMcp: new MCPServer({ name: 'Order MCP', version: '1.0.0', tools: { lookupOrder } }),
  },
  observability: new Observability({ configs: { default: { serviceName: 'orders' } } }),
});
```

Agents and workflows exposed as tools nest under the request span, and a served tool no longer produces a separate root `TOOL_CALL` span:

```
MCP_SERVER_REQUEST  tools/call ask_supportAgent
└── AGENT_RUN       support-agent
    └── TOOL_CALL   lookupOrder
```

See https://github.com/mastra-ai/mastra/issues/23921
