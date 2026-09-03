import { createTool } from '@mastra/core/tools';
import { z } from 'zod/v3';
import { MCPServer } from '../server/server';

let server: MCPServer;

const triggerToolListChanged = createTool({
  id: 'triggerToolListChanged',
  description: 'Publishes a tool-list-changed notification',
  inputSchema: z.object({}),
  execute: async () => {
    await server.toolActions.notifyListChanged();
    return 'notified';
  },
});

const traceContextTool = createTool({
  id: 'traceContextTool',
  description: 'Returns request trace metadata',
  inputSchema: z.object({}),
  execute: async (_inputData, options) => {
    const meta = options?.mcp?.extra?._meta;
    return JSON.stringify({
      traceparent: meta?.traceparent,
      tracestate: meta?.tracestate,
      baggage: meta?.baggage,
    });
  },
});

server = new MCPServer({
  name: 'Modern Era Notification Server',
  version: '1.0.0',
  tools: { triggerToolListChanged, traceContextTool },
});

await server.startStdio();
