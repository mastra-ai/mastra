/**
 * Koa Server Adapter Example
 *
 * This demonstrates how to use @mastra/koa to run Mastra with Koa.
 *
 * Features shown:
 * - Basic server setup with MastraServer
 * - Required koa-bodyparser middleware for JSON parsing
 * - Custom routes added after init()
 * - Accessing Mastra context via ctx.state.mastra
 */

import Koa from 'koa';
import bodyParser from 'koa-bodyparser';
import { MastraServer } from '@mastra/koa';

import { mastra } from './mastra';

const app = new Koa();
app.use(bodyParser()); // Required for body parsing

const server = new MastraServer({ app, mastra });

await server.init();

// Custom route with access to Mastra context via ctx.state.mastra
app.use(async (ctx, next) => {
  if (ctx.path === '/health' && ctx.method === 'GET') {
    const mastraInstance = ctx.state.mastra;
    const agents = Object.keys(mastraInstance.listAgents());
    ctx.body = { status: 'ok', agents };
    return;
  }
  await next();
});

const port = 4111;

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
  console.log(`Try: curl http://localhost:${port}/api/agents`);
});
