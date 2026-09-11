import { createMCPTool } from '@mastra/core/mcp';
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

const askName = createMCPTool({
  id: 'askName',
  description: 'Asks for a name before greeting',
  inputSchema: z.object({}),
  outputSchema: z.string(),
  execute: async (_input, { request }) => {
    const answer = request.inputResponses?.name;
    if (answer?.action === 'accept') {
      await request.log('info', { message: 'greeting' });
      return { kind: 'completed', value: `hello ${(answer.content as { name: string }).name}` };
    }
    return {
      kind: 'input_required',
      result: {
        resultType: 'input_required',
        inputRequests: {
          name: {
            method: 'elicitation/create',
            params: {
              mode: 'form',
              message: 'Your name?',
              requestedSchema: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] },
            },
          },
        },
      },
    };
  },
});

const traceContextTool = createTool({
  id: 'traceContextTool',
  description: 'Returns request trace metadata',
  inputSchema: z.object({}),
  execute: async (_input, context) => JSON.stringify(context.requestContext?.get('traceContext') ?? {}),
});

server = new MCPServer({
  name: 'Notification Server',
  version: '1.0.0',
  tools: { triggerToolListChanged, askName, traceContextTool },
});

await server.startStdio();
