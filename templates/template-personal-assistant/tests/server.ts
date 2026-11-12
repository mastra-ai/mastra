import { serve } from '@hono/node-server';
import type { CreateAgentScheduleInput } from '@mastra/core/schedules';
import type { ScheduleUpdate } from '@mastra/core/storage';
import { MastraServer } from '@mastra/hono';
import { Hono } from 'hono';
import { loadConfig } from '../src/mastra/config';
import { createAssistant } from '../src/mastra/runtime';

// Only the paid model endpoint is replaced. The Agent, server, tools, and storage remain native.
const config = loadConfig();
// Local auth composition regression only: never a remote Turso/Platform persistence proof.
if (config.runtime.mode === 'hosted' && process.env.TEST_AUTH_DATABASE_URL) {
  config.runtime.databaseUrl = process.env.TEST_AUTH_DATABASE_URL;
}
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
// Test-only IPC drives real native scheduling without opening a product HTTP bypass.
process.on('message', async (message: { requestId: string; operation: string; input: Record<string, unknown> }) => {
  const { requestId, operation, input } = message;
  try {
    const store = await mastra.getStorage()!.getStore('schedules');
    let result: unknown;
    if (operation === 'create') result = await mastra.schedules.create(input as unknown as CreateAgentScheduleInput);
    else if (operation === 'run') result = await mastra.schedules.run(String(input.id));
    else if (operation === 'row') result = await store!.getSchedule(String(input.id));
    else if (operation === 'patch')
      result = await store!.updateSchedule(String(input.id), input.patch as ScheduleUpdate);
    else if (operation === 'tick') {
      await mastra.scheduler!.tick();
      result = true;
    } else if (operation === 'publish') {
      const row = input.target
        ? { id: String(input.id), target: input.target }
        : await store!.getSchedule(String(input.id));
      await mastra.pubsub.publish('agent-schedules', {
        type: 'agent-schedule.fire',
        runId: String(input.claimId),
        data: {
          scheduleId: row!.id,
          claimId: input.claimId,
          scheduledFireAt: input.scheduledFireAt,
          target: row!.target,
        },
      });
      result = true;
    } else throw new Error('Unknown test control operation.');
    process.send?.({ requestId, result });
  } catch (error) {
    process.send?.({ requestId, error: String(error) });
  }
});
const app = new Hono();
await new MastraServer({ app, mastra }).init();
await mastra.startWorkers();
const server = serve({ fetch: app.fetch, hostname: '127.0.0.1', port: 0 }, info => process.send?.({ port: info.port }));
process.on('SIGTERM', () => {
  server.close(async () => {
    await mastra.shutdown();
    process.exit(0);
  });
  if ('closeAllConnections' in server) server.closeAllConnections();
});
