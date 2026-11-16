import { createTool } from '@mastra/core/tools';
import { z } from 'zod/v4';
import { MCPServer } from '../server';

const greet = createTool({
  id: 'greet',
  description: 'Greets someone',
  inputSchema: z.object({ name: z.string() }),
  execute: async ({ name }) => `hello ${name}`,
});

const server = new MCPServer({
  name: 'Tasks Stdio Server',
  version: '1.0.0',
  tools: { greet },
  tasks: { tools: { greet: 'always' } },
});

await server.startStdio();
