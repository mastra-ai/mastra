import { Agent } from '@mastra/core/agent';
import { createEventedAgent } from '@mastra/core/agent/durable';
import { Mastra } from '@mastra/core/mastra';
import { PostgresStore } from '@mastra/pg';
import { RedisStreamsPubSub } from '../src/index.ts';

const role = process.env.TAKEOVER_ROLE;
const storage = new PostgresStore({
  id: `takeover-${role}`,
  connectionString: process.env.POSTGRES_CONNECTION_STRING,
  schemaName: process.env.TAKEOVER_SCHEMA,
});
const pubsub = new RedisStreamsPubSub({
  url: process.env.REDIS_URL,
  keyPrefix: process.env.TAKEOVER_PREFIX,
  blockMs: 100,
  reclaimIntervalMs: 1000,
  // Leave the production idle threshold intact; it must exceed the 30s step lease.
});
const model = {
  specificationVersion: 'v2',
  provider: 'test',
  modelId: 'takeover-test',
  supportedUrls: {},
  async doGenerate() {
    throw new Error('stream only');
  },
  async doStream() {
    console.info('model-entered');
    if (role === 'victim') await new Promise(() => {});
    return {
      stream: new ReadableStream({
        start(controller) {
          for (const chunk of [
            { type: 'stream-start', warnings: [] },
            { type: 'text-start', id: 'answer' },
            { type: 'text-delta', id: 'answer', delta: 'Recovered successfully' },
            { type: 'text-end', id: 'answer' },
            { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
          ]) {
            controller.enqueue(chunk);
          }
          controller.close();
        },
      }),
    };
  },
};
const agent = createEventedAgent({
  agent: new Agent({ id: 'takeover-agent', name: 'takeover-agent', instructions: 'Answer.', model }),
});
const mastra = new Mastra({ storage, pubsub, agents: { [agent.id]: agent } });
await storage.init();
if (role !== 'api') await mastra.startWorkers();
console.info('takeover-ready');
if (role === 'api') {
  const { output } = await agent.stream('Hello');
  console.info(`caller-completed:${await output.text}`);
}
setInterval(() => {}, 1000);
