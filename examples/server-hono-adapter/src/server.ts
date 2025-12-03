/**
 * Hono Server Adapter Example
 *
 * This demonstrates how to use @mastra/hono to run Mastra with Hono.
 *
 * Features shown:
 * - Basic server setup with MastraServer
 * - Custom routes added after init()
 * - Accessing Mastra context in custom routes
 */

import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { MastraServer } from '@mastra/hono';

import { mastra } from './mastra';

const app = new Hono();
const server = new MastraServer({ app: app as any, mastra });

await server.init();

// Custom route with access to Mastra context
// Note: c.get() typing requires assertion due to Hono's generic context
app.get('/health', c => {
  const mastraInstance = c.get('mastra' as never) as typeof mastra;
  const agents = Object.keys(mastraInstance.listAgents());
  return c.json({ status: 'ok', agents });
});

const port = 4111;

serve({ fetch: app.fetch, port }, () => {
  console.log(`Server running on http://localhost:${port}`);
  console.log(`Try: curl http://localhost:${port}/api/agents`);
});
