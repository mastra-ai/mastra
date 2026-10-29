/**
 * Empty Observer output (#27260)
 *
 * An Observer reply with no text (HTTP 200 with empty content, a text-less
 * refusal, a stream with no text deltas) must not be committed as an
 * observation: that would advance `lastObservedAt` past messages that were
 * never observed. It is retried like a transport error, and once retries run
 * out `failurePolicy` decides what happens to the turn.
 *
 * Runs a real Agent + Memory turn with a real OpenAI provider pointed at
 * AIMock for both the actor and the Observer. Thread scope exercises the
 * single-thread Observer; resource scope exercises the multi-thread Observer.
 */

import { createOpenAI } from '@ai-sdk/openai-v5';
import { LLMock } from '@copilotkit/aimock';
import type { FixtureResponse } from '@copilotkit/aimock';
import { Agent } from '@mastra/core/agent';
import { InMemoryStore } from '@mastra/core/storage';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { Memory } from '../../../index';
import { RETRY_CONFIG } from '../retry';

const ACTOR = 'actor-model';
const OBSERVER = 'observer-model';
const THREAD = 'empty-observer-thread';
const RESOURCE = 'empty-observer-resource';
const USER_REQUEST = `USER_REQUEST_MARKER: plan the billing database migration. ${'It must have zero downtime. '.repeat(10)}`;
const ACTOR_REPLY = 'Here is a migration plan.';
const OBSERVATION = '* 🔴 User is planning a zero-downtime billing database migration';

const goodObserverReply = (scope: 'thread' | 'resource') =>
  scope === 'thread'
    ? `<observations>\n${OBSERVATION}\n</observations>`
    : `<observations>\n<thread id="${THREAD}">\n${OBSERVATION}\n</thread>\n</observations>`;

const degenerateObserverReply = Array(20)
  .fill(
    Array.from({ length: 5 }, (_, i) => `- 🟡 Looping observation number ${i} about the same repeated topic`).join(
      '\n',
    ),
  )
  .join('\n');

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

async function runTurn({
  scope,
  observerReplies,
  maxRetries,
  failurePolicy,
}: {
  scope: 'thread' | 'resource';
  /** Observer replies in call order; the last one repeats. */
  observerReplies: FixtureResponse[];
  maxRetries: number;
  failurePolicy?: 'abort' | 'continue';
}) {
  observerReplies.forEach((reply, sequenceIndex) => {
    mock.on({ endpoint: 'chat', model: OBSERVER, sequenceIndex }, reply);
  });
  mock.on({ endpoint: 'chat', model: OBSERVER }, observerReplies.at(-1)!);
  mock.on({ endpoint: 'chat', model: ACTOR }, { content: ACTOR_REPLY });

  const openai = createOpenAI({ apiKey: 'test-key', baseURL: `${mock.url}/v1` });
  const store = new InMemoryStore();
  const agent = new Agent({
    id: 'empty-observer-agent',
    name: 'Empty Observer Agent',
    instructions: 'You are a helpful assistant.',
    model: openai.chat(ACTOR),
    memory: new Memory({
      storage: store,
      options: {
        observationalMemory: {
          enabled: true,
          scope,
          observation: {
            model: openai.chat(OBSERVER),
            messageTokens: 20,
            bufferTokens: false,
            maxRetries,
            ...(failurePolicy ? { failurePolicy } : {}),
          },
          reflection: { model: openai.chat(OBSERVER), observationTokens: 100_000 },
        },
      },
    }),
  });

  const result = await agent.generate(USER_REQUEST, { memory: { thread: THREAD, resource: RESOURCE } });

  const memoryStore = (await store.getStore('memory'))!;
  const record = await memoryStore.getObservationalMemory(scope === 'resource' ? null : THREAD, RESOURCE);
  const observerCalls = mock.getRequests().filter(request => request.body?.model === OBSERVER);
  return { result, record, observerCalls };
}

describe('empty Observer output', { timeout: 30_000 }, () => {
  describe.each(['thread', 'resource'] as const)('%s scope', scope => {
    it.each([
      ['no text', [{ content: '' }]],
      ['whitespace-only text', [{ content: '  \n' }]],
      [
        'degenerate output, then no text on the degenerate retry',
        [{ content: degenerateObserverReply }, { content: '' }],
      ],
    ] as const)('does not advance lastObservedAt when the Observer returns %s', async (_label, observerReplies) => {
      const { result, record, observerCalls } = await runTurn({
        scope,
        observerReplies: [...observerReplies],
        maxRetries: 0,
        failurePolicy: 'continue',
      });

      expect(observerCalls).toHaveLength(observerReplies.length);
      expect(result.tripwire).toBeUndefined();
      expect(result.text).toBe(ACTOR_REPLY);
      expect(record?.lastObservedAt).toBeUndefined();
      expect(record?.activeObservations ?? '').toBe('');
    });

    it('retries an empty reply and observes the messages from the next good reply', async () => {
      const { result, record, observerCalls } = await runTurn({
        scope,
        observerReplies: [{ content: '' }, { content: goodObserverReply(scope) }],
        maxRetries: 1,
      });

      expect(observerCalls).toHaveLength(2);
      expect(observerCalls[1]!.body.messages).toEqual(observerCalls[0]!.body.messages);
      expect(result.tripwire).toBeUndefined();
      expect(result.text).toBe(ACTOR_REPLY);
      expect(record?.lastObservedAt).toBeInstanceOf(Date);
      expect(record?.activeObservations).toContain('zero-downtime billing database migration');
    });

    it("stops the turn under failurePolicy 'abort' once retries are used up", async () => {
      const { result, record, observerCalls } = await runTurn({
        scope,
        observerReplies: [{ content: '' }],
        maxRetries: 1,
        failurePolicy: 'abort',
      });

      expect(observerCalls).toHaveLength(2);
      expect(result.text).toBe('');
      expect(result.tripwire?.reason).toContain('Encountered error during memory observation');
      expect(result.tripwire?.reason).toContain('returned empty output');
      expect(record?.lastObservedAt).toBeUndefined();
      expect(record?.activeObservations ?? '').toBe('');
    });
  });
});
