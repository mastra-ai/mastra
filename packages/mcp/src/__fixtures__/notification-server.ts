import { createTool } from '@mastra/core/tools';
import { z } from 'zod/v4';
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

const askName = createTool({
  id: 'askName',
  description: 'Asks for a name before greeting',
  inputSchema: z.object({}),
  outputSchema: z.string(),
  suspendSchema: z.object({ message: z.string() }),
  resumeSchema: z.object({ name: z.string() }),
  execute: async (_input, context) => {
    if (!context.resumeData) {
      await context.suspend?.({ message: 'Your name?' });
      return;
    }
    await context.mcp?.log?.('info', 'greeting');
    return `hello ${context.resumeData.name}`;
  },
});

server = new MCPServer({
  name: 'Notification Server',
  version: '1.0.0',
  tools: { triggerToolListChanged, askName },
  requestState: { key: 'fixture-key-fixture-key-fixture-key-1234' },
});

await server.startStdio();
