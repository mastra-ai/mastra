import path from 'node:path';
import { serve } from '@hono/node-server';
import { MCPClient } from '@mastra/mcp';
import { Hono } from 'hono';
import { prepare } from '../../../scripts/prepare-docs';

// Set up test Hono server
const app = new Hono();

// Start the server
export const server = serve({
  fetch: app.fetch,
  port: 0,
});

// Get the actual port the server is running on
const port = (server.address() as { port: number }).port;

const sourceMode = process.env.MASTRA_SOURCE_MODE === '1';

export const docsReady = prepare();

export const mcp = new MCPClient({
  id: 'test-mcp',
  servers: {
    mastra: {
      command: sourceMode ? path.join(__dirname, '../../../node_modules/.bin/tsx') : process.execPath,
      args: sourceMode ? [path.join(__dirname, '../../stdio.ts')] : [path.join(__dirname, '../../../dist/stdio.js')],
      env: {
        ...process.env,
        BLOG_URL: `http://localhost:${port}`,
      },
    },
  },
});

export async function callTool(tool: any, args: any) {
  const response = await tool.execute(args, { suspend: async () => {} });

  // Handle string responses
  if (typeof response === 'string') {
    return response;
  }

  // Handle validation error responses
  if (response?.error === true && response?.message) {
    return response.message;
  }

  // Handle content array responses
  if (response?.content) {
    let text = ``;
    for (const part of response.content) {
      if (part?.type === `text`) {
        text += part?.text;
      } else {
        throw new Error(`Found tool content part that's not accounted for. ${JSON.stringify(part, null, 2)}`);
      }
    }
    return text;
  }

  throw new Error('Unexpected response format');
}
