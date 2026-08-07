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

server = new MCPServer({
  name: 'Modern Era Notification Server',
  version: '1.0.0',
  protocolVersion: '2026-07-28',
  tools: { triggerToolListChanged },
});

await server.startStdio();
