/**
 * Fastify Server Adapter Example
 *
 * This demonstrates how to use @mastra/fastify to run Mastra with Fastify.
 *
 * Features shown:
 * - Basic server setup with MastraServer
 * - Custom routes added after init()
 * - Accessing Mastra context via request.mastra
 */

import Fastify from 'fastify';
import { MastraServer } from '@mastra/fastify';

import { mastra } from './mastra';

const app = Fastify();
const server = new MastraServer({ app, mastra });

await server.init();

// Custom route with access to Mastra context via request.mastra
app.get('/health', async request => {
  const mastraInstance = request.mastra;
  const agents = Object.keys(mastraInstance.listAgents());
  return { status: 'ok', agents };
});

const port = 4111;

app.listen({ port }, () => {
  console.log(`Server running on http://localhost:${port}`);
  console.log(`Try: curl http://localhost:${port}/api/agents`);
});
