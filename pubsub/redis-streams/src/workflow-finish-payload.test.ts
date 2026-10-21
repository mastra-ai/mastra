import { randomUUID } from 'node:crypto';
import { Mastra } from '@mastra/core/mastra';
import { InMemoryStore } from '@mastra/core/storage';
import { createStep } from '@mastra/core/workflows';
import { createWorkflow } from '@mastra/core/workflows/evented';
import { createClient } from 'redis';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { REDIS_URL } from '../test-fixtures/harness';
import { RedisStreamsPubSub } from './index';

const inspector = createClient({ url: REDIS_URL });

beforeAll(async () => {
  await inspector.connect();
});

afterAll(async () => {
  await inspector.quit();
});

describe('nested workflow finish over Redis Streams', () => {
  it.each([1024, 2 * 1024 * 1024])(
    'streams completion with %i bytes of parent history without replicating it',
    async size => {
      const child = createWorkflow({
        id: 'redis_child',
        inputSchema: z.object({ prompt: z.string() }),
        outputSchema: z.object({ answer: z.string() }),
      })
        .then(
          createStep({
            id: 'respond',
            inputSchema: z.object({ prompt: z.string() }),
            outputSchema: z.object({ answer: z.string() }),
            execute: async ({ inputData }) => ({ answer: `Answered: ${inputData.prompt}` }),
          }),
        )
        .commit();
      const parent = createWorkflow({
        id: 'redis_parent',
        inputSchema: z.object({ prompt: z.string() }),
        outputSchema: z.object({ answer: z.string() }),
      })
        .then(
          createStep({
            id: 'load_history',
            inputSchema: z.object({ prompt: z.string() }),
            outputSchema: z.object({ prompt: z.string(), history: z.string() }),
            execute: async ({ inputData }) => ({ prompt: inputData.prompt, history: 'x'.repeat(size) }),
          }),
        )
        .map(({ inputData }) => ({ prompt: inputData.prompt }))
        .then(child)
        .commit();
      const keyPrefix = `finish-payload-${randomUUID()}`;
      const pubsub = new RedisStreamsPubSub({ url: REDIS_URL, keyPrefix, blockMs: 200 });
      const mastra = new Mastra({
        logger: false,
        storage: new InMemoryStore(),
        workflows: { redis_parent: parent, redis_child: child },
        pubsub,
      });
      try {
        await mastra.startWorkers();
        const run = await parent.createRun();
        const stream = run.stream({ inputData: { prompt: 'hello' } });
        const chunks: Array<{ type: string }> = [];
        for await (const chunk of stream.fullStream) chunks.push(chunk);
        const result = await stream.result;
        expect(result.status).toBe('success');
        expect(result.status === 'success' && result.result).toEqual({ answer: 'Answered: hello' });
        expect(chunks.some(chunk => chunk.type === 'workflow-finish')).toBe(true);

        const entries = await inspector.xRange(`${keyPrefix}:workflows-finish`, '-', '+');
        const childFinish = entries
          .map(({ message }) => message.event)
          .filter((event): event is string => typeof event === 'string')
          .filter(event => JSON.parse(event).data.workflowId === 'redis_child');
        expect(childFinish).toHaveLength(1);
        expect(Buffer.byteLength(childFinish[0]!)).toBeLessThan(4096);
      } finally {
        await mastra.stopWorkers();
        await pubsub.close();
      }
    },
  );
});
