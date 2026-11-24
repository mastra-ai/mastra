import { randomUUID } from 'node:crypto';
import { createOpenAI } from '@ai-sdk/openai-v5';
import { LLMock } from '@copilotkit/aimock';
import { Agent } from '@mastra/core/agent';
import { createEventedAgent } from '@mastra/core/agent/durable';
import { Mastra } from '@mastra/core/mastra';
import { InMemoryStore } from '@mastra/core/storage';
import { createTool } from '@mastra/core/tools';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { RedisStreamsPubSub } from './index';

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6381';

/**
 * A throwing `stopWhen` on an evented agent must be called once when the host
 * bus is `RedisStreamsPubSub`. This transport redelivers nacked events, so the
 * continuation event used to be redelivered until its delivery-attempt limit
 * and the predicate ran three times.
 */
describe('evented agent: throwing stopWhen over RedisStreamsPubSub', () => {
  let mock: LLMock | undefined;
  const pubsubs: RedisStreamsPubSub[] = [];

  beforeAll(async () => {
    mock = new LLMock({ port: 0 });
    await mock.start();
  });

  afterEach(async () => {
    mock?.clearFixtures();
    mock?.clearRequests();
    mock?.resetMatchCounts();
    await Promise.allSettled(pubsubs.splice(0).map(p => p.close()));
  });

  afterAll(async () => {
    await mock?.stop();
    mock = undefined;
  });

  it('calls a throwing stopWhen once and rejects the stream with its error', async () => {
    if (!mock) throw new Error('AIMock server is not running');

    const pubsub = new RedisStreamsPubSub({
      url: REDIS_URL,
      keyPrefix: `aimock-${randomUUID()}`,
      blockMs: 200,
    });
    pubsubs.push(pubsub);

    let stopWhenCalls = 0;
    let toolCalls = 0;
    const step = createTool({
      id: 'step',
      description: 'Advance one step.',
      inputSchema: z.object({ n: z.number() }),
      execute: async ({ n }) => {
        toolCalls++;
        return { done: n };
      },
    });

    mock.on(
      { endpoint: 'chat', hasToolResult: false },
      { toolCalls: [{ id: 'call-1', name: 'step', arguments: { n: 1 } }] },
    );
    mock.on({ endpoint: 'chat', hasToolResult: true }, { content: 'done' });

    const openai = createOpenAI({
      apiKey: 'aimock-test-key',
      baseURL: `${mock.url.replace(/\/+$/, '')}/v1`,
    });
    const agent = new Agent({
      id: `aimock-redis-stopwhen-${randomUUID()}`,
      name: 'AIMock Redis stopWhen Agent',
      instructions: 'You are a test agent driven by scripted AIMock responses.',
      model: openai('gpt-4o-mini'),
      tools: { step },
    });
    const evented = createEventedAgent({ agent, pubsub });
    const mastra = new Mastra({
      agents: { [evented.id]: evented },
      logger: false,
      storage: new InMemoryStore(),
      pubsub,
    });

    const { fullStream } = await mastra.getAgentById(evented.id).stream('Go.', {
      maxSteps: 10,
      stopWhen: (() => {
        stopWhenCalls++;
        throw new Error('stopWhen exploded');
      }) as any,
    });

    const chunkTypes: string[] = [];
    let streamError: unknown;
    try {
      for await (const chunk of fullStream as AsyncIterable<{ type: string }>) chunkTypes.push(chunk.type);
    } catch (error) {
      streamError = error;
    }

    // Let any redelivery the transport schedules land before counting.
    await new Promise(resolve => setTimeout(resolve, 1000));

    expect(stopWhenCalls).toBe(1);
    expect(streamError).toMatchObject({ message: 'stopWhen exploded' });
    expect(toolCalls).toBe(1);
    expect(mock.getRequests()).toHaveLength(1);
    expect(chunkTypes).not.toContain('finish');
  });
});
