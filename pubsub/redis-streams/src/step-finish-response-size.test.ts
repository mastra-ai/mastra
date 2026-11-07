import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { createOpenAI } from '@ai-sdk/openai-v5';
import { LLMock } from '@copilotkit/aimock';
import { Agent } from '@mastra/core/agent';
import { createEventedAgent } from '@mastra/core/agent/durable';
import { Mastra } from '@mastra/core/mastra';
import { InMemoryStore } from '@mastra/core/storage';
import { createTool } from '@mastra/core/tools';
import { createClient } from 'redis';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { RedisStreamsPubSub } from './index';

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6381';
const STEPS = 8;
const RESULT_BYTES = 20_000;
const execFileAsync = promisify(execFile);

describe('evented agent Redis Streams step-finish transport', () => {
  let mock: LLMock;

  beforeAll(async () => {
    mock = new LLMock({ port: 0 });
    await mock.start();
  });

  afterAll(async () => {
    await mock?.stop();
  });

  it('writes only changed response messages on long turns without losing tool results', async () => {
    const prefix = `response-size-${randomUUID()}`;
    const pubsub = new RedisStreamsPubSub({ url: REDIS_URL, keyPrefix: prefix, blockMs: 200 });
    const redis = createClient({ url: REDIS_URL });
    await redis.connect();
    try {
      const payload = 'x'.repeat(RESULT_BYTES);
      const tool = createTool({
        id: 'shot',
        description: 'Return a large result',
        inputSchema: z.object({ index: z.number() }),
        outputSchema: z.any(),
        execute: async ({ index }) => ({ index, image: payload }),
      });
      mock.on(
        { endpoint: 'chat', hasToolResult: false },
        {
          toolCalls: [{ id: 'call-1', name: 'shot', arguments: { index: 1 } }],
        },
      );
      for (let index = 2; index <= STEPS; index++) {
        mock.on(
          { endpoint: 'chat', toolCallId: `call-${index - 1}` },
          {
            toolCalls: [{ id: `call-${index}`, name: 'shot', arguments: { index } }],
          },
        );
      }
      mock.on({ endpoint: 'chat', toolCallId: `call-${STEPS}` }, { content: 'done' });

      const model = createOpenAI({ apiKey: 'aimock-test-key', baseURL: `${mock.url.replace(/\/+$/, '')}/v1` });
      const agent = new Agent({
        id: `response-size-${randomUUID()}`,
        name: 'Response size agent',
        instructions: 'Follow the scripted responses.',
        model: model('gpt-4o-mini'),
        tools: { shot: tool },
      });
      const evented = createEventedAgent({ agent, pubsub, maxSteps: STEPS + 2 });
      const mastra = new Mastra({
        agents: { [agent.id]: evented },
        storage: new InMemoryStore(),
        pubsub,
        logger: false,
      });
      const output = await mastra.getAgent(agent.id).stream('go');
      const chunks = [];
      for await (const chunk of output.fullStream) chunks.push(chunk);
      expect(chunks.filter(chunk => chunk.type === 'tool-result')).toHaveLength(STEPS);
      expect(mock.getRequests()).toHaveLength(STEPS + 1);
      // The stream output rebuilds the whole response from the step-finish deltas.
      const steps = await output.output.steps;
      const toolMessages = steps.at(-1)!.response.messages.filter(message => message.role === 'tool');
      expect(toolMessages).toHaveLength(STEPS);

      const keys = await redis.keys(`${prefix}:agent.stream.*`);
      expect(keys).toHaveLength(1);
      const frames = (await redis.xRange(keys[0]!, '-', '+'))
        .map(entry => entry.message.event)
        .filter((event): event is string => typeof event === 'string')
        .filter(event => JSON.parse(event).data?.type === 'step-finish');
      expect(frames).toHaveLength(STEPS + 1);
      expect(JSON.parse(frames[0]!).data.payload._durableResponseMessagesFrom).toBe(0);
      expect(JSON.parse(frames[STEPS - 1]!).data.payload._durableResponseMessagesFrom).toBeGreaterThan(0);
      expect(Math.max(...frames.map(frame => Buffer.byteLength(frame)))).toBeLessThan(2.5 * RESULT_BYTES);
      // Each frame also carries the current step's tool output separately from the response delta.
      expect(frames.reduce((total, frame) => total + Buffer.byteLength(frame), 0)).toBeLessThan(20 * RESULT_BYTES);

      const worker = fileURLToPath(new URL('../test-fixtures/response-observer.entry.ts', import.meta.url));
      const runObserver = async (firstStep: number) => {
        const { stdout } = await execFileAsync(
          './node_modules/.bin/tsx',
          [worker, REDIS_URL, keys[0]!, String(firstStep)],
          {
            cwd: fileURLToPath(new URL('..', import.meta.url)),
          },
        );
        return JSON.parse(stdout.trim().split('\n').at(-1)!) as { observed: string[][] };
      };
      const expectedIds = Array.from({ length: STEPS }, (_, index) => `call-${index + 1}`);
      const full = await runObserver(0);
      expect(full.observed).toEqual(
        Array.from({ length: STEPS + 1 }, (_, index) => expectedIds.slice(0, Math.min(index + 1, STEPS))),
      );
      // A consumer that starts after the first step-finish cannot reconstruct older messages.
      const late = await runObserver(2);
      expect(late.observed.at(-1)).toEqual(expectedIds.slice(2));
    } finally {
      await pubsub.close();
      const keys = await redis.keys(`${prefix}:*`);
      if (keys.length) await redis.del(keys);
      await redis.quit();
    }
  }, 30_000);
});
