import { serve } from '@hono/node-server';
import { MastraServer } from '@mastra/hono';
import { Hono } from 'hono';
import { createAssistant } from '../src/mastra/assistant';
import { loadConfig } from '../src/mastra/config';

// Only the paid model endpoint is replaced. The Agent, server, tools, and storage remain native.
const config = loadConfig();
const mastra = createAssistant(
  config,
  { id: config.model, url: process.env.TEST_MODEL_URL, apiKey: 'example-key' },
  { id: config.judgeModel, url: `${process.env.TEST_MODEL_URL}/judge`, apiKey: 'example-key' },
);
const memory = await mastra.getAgent('personalAssistant').getMemory();
if (process.env.TEST_SEED_FOREIGN === 'true') {
  await memory!.createThread({
    threadId: 'foreign-thread',
    resourceId: 'foreign-owner',
    title: 'Foreign private context',
  });
  await memory!.saveMessages({
    messages: [
      {
        id: 'foreign-message',
        threadId: 'foreign-thread',
        resourceId: 'foreign-owner',
        role: 'user',
        createdAt: new Date(),
        content: { format: 2, parts: [{ type: 'text', text: 'foreign-private-marker' }] },
      },
    ],
  });
  await memory!.updateWorkingMemory({
    threadId: 'foreign-thread',
    resourceId: 'foreign-owner',
    workingMemory: 'foreign-preference-marker',
  });
}
const app = new Hono();
await new MastraServer({ app, mastra }).init();
const server = serve({ fetch: app.fetch, hostname: '127.0.0.1', port: 0 }, info => process.send?.({ port: info.port }));
process.on('SIGTERM', () => {
  server.close(async () => {
    await mastra.shutdown();
    process.exit(0);
  });
  if ('closeAllConnections' in server) server.closeAllConnections();
});
