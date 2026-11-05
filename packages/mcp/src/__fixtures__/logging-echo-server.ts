import { createTool } from '@mastra/core/tools';
import { z } from 'zod/v4';
import { MCPServer } from '../server/server';

// A stdio server whose tool sends a server log message before it answers.
const echo = createTool({
  id: 'echo',
  description: 'Logs the text, then echoes it back',
  inputSchema: z.object({ text: z.string() }),
  execute: async ({ text }, context) => {
    await context.mcp?.log?.('info', `echo ${text}`);
    return `echo: ${text}`;
  },
});

await new MCPServer({ name: 'Logging Echo Server', version: '1.0.0', tools: { echo } }).startStdio();
