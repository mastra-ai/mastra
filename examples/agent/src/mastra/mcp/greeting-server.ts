import { Agent } from '@mastra/core/agent';
import { createTool } from '@mastra/core/tools';
import { MCPClient, MCPServer } from '@mastra/mcp';
import { greetingApp } from '@mastra/mcp-apps-components';
import { Memory } from '@mastra/memory';
import { z } from 'zod';

const GREETING_SERVER_ID = 'greeting-mcp-server';
const GREETING_URI = 'ui://mastra/greeting';
// This Mastra server, which the agent reaches over HTTP like any MCP client. `mastra dev` falls back to
// another port when 4111 is taken and passes the one it bound as PORT.
const MASTRA_SERVER_URL = process.env.MASTRA_BASE_URL ?? `http://localhost:${process.env.PORT ?? 4111}`;

// Visible to the model: opens the greeting app. The host sends the app these arguments.
const showGreeting = createTool({
  id: 'showGreeting',
  description: 'Shows a greeting card for someone, in the chat.',
  inputSchema: z.object({ name: z.string().describe('Who to greet') }),
  mcp: { _meta: { ui: { resourceUri: GREETING_URI } } },
  execute: async ({ name }) => ({ name }),
});

// Visible to the app only: the app calls it to fetch its data. It runs on the server, so it can
// reach any API with the server's credentials; the iframe itself has no network access.
const getGreeting = createTool({
  id: 'getGreeting',
  description: 'Returns the greeting for a name.',
  inputSchema: z.object({ name: z.string() }),
  outputSchema: z.object({ greeting: z.string() }),
  mcp: { _meta: { ui: { resourceUri: GREETING_URI, visibility: ['app'] } } },
  execute: async ({ name }) => {
    const response = await fetch('https://api.github.com/zen');
    if (!response.ok) throw new Error(`GitHub answered ${response.status}`);
    return { greeting: `Hello, ${name}! ${await response.text()}` };
  },
});

export const greetingMcpServer = new MCPServer({
  id: GREETING_SERVER_ID,
  name: 'Greeting MCP Server',
  version: '1.0.0',
  appResources: { [GREETING_URI]: greetingApp },
  tools: { showGreeting, getGreeting },
});

// The server key matches the server id so Studio maps the namespaced tool
// (`greeting-mcp-server_showGreeting`) back to its ui:// app.
const greetingMcpClient = new MCPClient({
  id: 'greeting-mcp-client',
  servers: {
    [GREETING_SERVER_ID]: { url: new URL(`/api/mcp/${GREETING_SERVER_ID}/mcp`, MASTRA_SERVER_URL) },
  },
});

export const greetingAgent = new Agent({
  id: 'greeting-agent',
  name: 'Greeting Agent',
  description: 'Greets people with a greeting card in the chat.',
  instructions: `When the user asks you to greet someone, call the greeting tool with their name.
The card renders in the chat, so just say in one short sentence that you've greeted them.`,
  model: 'openai/gpt-5-mini',
  memory: new Memory(),
  tools: () => greetingMcpClient.listTools(),
});
