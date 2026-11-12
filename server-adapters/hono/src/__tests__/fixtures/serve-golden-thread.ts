import { serve } from '@hono/node-server';
import { goldenThreadFixture } from './golden-thread';

const { app, mastra } = await goldenThreadFixture();
const server = serve({ fetch: app.fetch, hostname: '127.0.0.1', port: 4181 });
console.log('Golden thread fixture: http://localhost:4181/api/agents');
process.on('SIGINT', async () => {
  server.close();
  await mastra.observability.shutdown();
  process.exit(0);
});
