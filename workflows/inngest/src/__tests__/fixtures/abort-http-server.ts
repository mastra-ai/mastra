import { serve } from '@hono/node-server';
import { SimpleAuth } from '@mastra/core/server';
import { createHonoServer } from '@mastra/deployer/server';
import { buildAbortHttpAgent } from './abort-http-agent';

const [dbUrl, agentId, port, mockUrl, outDir] = process.argv.slice(2);
if (!dbUrl || !agentId || !mockUrl || !outDir) throw new Error('Missing server arguments');

// This process never starts a run: an HTTP abort can only succeed via a worker acknowledgement.
const auth = new SimpleAuth({
  tokens: { 'token-a': { id: 'user-a' } },
  mapUserToResourceId: (user: { id: string }) => user.id,
});
const { mastra } = buildAbortHttpAgent({ dbUrl, agentId, inngestPort: Number(port), mockUrl, outDir, auth });
const app = await createHonoServer(mastra);
serve({ fetch: app.fetch, port: 0 }, address => console.log(`[server] ready ${address.port}`));
process.on('SIGTERM', () => process.exit(0));
