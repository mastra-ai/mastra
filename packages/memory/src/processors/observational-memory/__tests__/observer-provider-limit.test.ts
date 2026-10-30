/**
 * An Observer call refused by a provider limit aborts the turn. The failed marker
 * carries the provider's status and codes beside the message, so a consumer such
 * as Factory can tell a rate limit apart from any other memory failure (#28696).
 *
 * Runs a real Agent + Memory turn with a real OpenAI provider pointed at AIMock.
 */

import { createOpenAI } from '@ai-sdk/openai-v5';
import { LLMock } from '@copilotkit/aimock';
import { Agent } from '@mastra/core/agent';
import { InMemoryStore } from '@mastra/core/storage';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { Memory } from '../../../index';
import { RETRY_CONFIG } from '../retry';

const ACTOR = 'actor-model';
const OBSERVER = 'observer-model';
const USER_REQUEST = `Plan the billing database migration. ${'It must have zero downtime. '.repeat(10)}`;

let mock: LLMock;
const originalRetryConfig = { ...RETRY_CONFIG };

beforeAll(async () => {
  RETRY_CONFIG.initialDelayMs = 1;
  RETRY_CONFIG.maxDelayMs = 4;
  RETRY_CONFIG.jitter = 0;
  mock = new LLMock({ port: 0 });
  await mock.start();
});

afterEach(() => {
  mock.clearFixtures();
  mock.clearRequests();
  mock.resetMatchCounts();
});

afterAll(async () => {
  Object.assign(RETRY_CONFIG, originalRetryConfig);
  await mock.stop();
});

async function runTurn() {
  mock.on(
    { endpoint: 'chat', model: OBSERVER },
    {
      status: 429,
      retryAfter: 0,
      error: { message: 'Rate limit reached for requests', type: 'requests', code: 'rate_limit_exceeded' },
    },
  );
  mock.on({ endpoint: 'chat', model: ACTOR }, { content: 'Here is a migration plan.' });

  const openai = createOpenAI({ apiKey: 'test-key', baseURL: `${mock.url}/v1` });
  const agent = new Agent({
    id: 'observer-provider-limit-agent',
    name: 'Observer Provider Limit Agent',
    instructions: 'You are a helpful assistant.',
    model: openai.chat(ACTOR),
    memory: new Memory({
      storage: new InMemoryStore(),
      options: {
        observationalMemory: {
          enabled: true,
          scope: 'thread',
          observation: { model: openai.chat(OBSERVER), messageTokens: 20, bufferTokens: false, maxRetries: 0 },
          reflection: { model: openai.chat(OBSERVER), observationTokens: 100_000 },
        },
      },
    }),
  });

  const output = await agent.stream(USER_REQUEST, { memory: { thread: 'thread-1', resource: 'resource-1' } });
  const chunks: Array<{ type: string; data?: unknown }> = [];
  for await (const chunk of output.fullStream) chunks.push(chunk);
  return chunks;
}

describe('an Observer call refused by a provider limit', { timeout: 30_000 }, () => {
  it('says which provider status and codes refused it on the failed marker', async () => {
    const chunks = await runTurn();

    const failed = chunks.find(chunk => chunk.type === 'data-om-observation-failed');
    expect(failed?.data).toMatchObject({
      failureKind: 'observer-model',
      providerError: { statusCode: 429, codes: expect.arrayContaining(['rate_limit_exceeded']) },
    });
  });
});
