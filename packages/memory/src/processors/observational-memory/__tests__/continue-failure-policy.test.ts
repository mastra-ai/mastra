/**
 * `failurePolicy: 'continue'` scope (#27263)
 *
 * Under `failurePolicy: 'continue'` an Observational Memory failure must not
 * end the agent turn unless the turn itself was cancelled. Covers Observer
 * failures that are not plain provider errors: output that stays degenerate
 * after the retry, and an abort raised inside the Observer call (for example a
 * caller-provided time budget) while the turn's own signal is untouched, and
 * a storage adapter rejecting the observation commit or the record load.
 *
 * Runs a real Agent + Memory turn with a real OpenAI provider pointed at
 * AIMock for both the actor and the Observer. The abort case wraps the
 * provider's fetch so the Observer request rejects with an AbortError before
 * reaching AIMock; AIMock cannot make a request reject on the client side.
 */

import { createOpenAI } from '@ai-sdk/openai-v5';
import { LLMock } from '@copilotkit/aimock';
import type { FixtureResponse } from '@copilotkit/aimock';
import { Agent } from '@mastra/core/agent';
import { InMemoryStore } from '@mastra/core/storage';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { Memory } from '../../../index';
import { RETRY_CONFIG } from '../retry';

const ACTOR = 'actor-model';
const OBSERVER = 'observer-model';
const THREAD = 'continue-policy-thread';
const RESOURCE = 'continue-policy-resource';
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

function abortObserverRequests(name: 'AbortError' | 'TimeoutError'): typeof fetch {
  return async (input, init) => {
    const body = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined;
    if (body?.model === OBSERVER) {
      throw new DOMException('The operation was aborted due to the caller time budget.', name);
    }
    return fetch(input, init);
  };
}

async function runTurn({
  scope,
  observerReply,
  failurePolicy,
  observerFetch,
  failCommit = false,
  failLoad = false,
}: {
  scope: 'thread' | 'resource';
  observerReply?: FixtureResponse;
  failurePolicy: 'abort' | 'continue';
  observerFetch?: typeof fetch;
  /** Make the storage adapter reject every observation commit. */
  failCommit?: boolean;
  /** Make the storage adapter reject every Observational Memory record read. */
  failLoad?: boolean;
}) {
  if (observerReply) mock.on({ endpoint: 'chat', model: OBSERVER }, observerReply);
  mock.on({ endpoint: 'chat', model: ACTOR }, { content: ACTOR_REPLY });

  const openai = createOpenAI({ apiKey: 'test-key', baseURL: `${mock.url}/v1` });
  const observerProvider = createOpenAI({ apiKey: 'test-key', baseURL: `${mock.url}/v1`, fetch: observerFetch });
  const store = new InMemoryStore();
  const memoryStore = (await store.getStore('memory'))!;
  const commit = vi
    .spyOn(memoryStore, 'commitActiveObservations')
    .mockRejectedValue(new Error('storage adapter unavailable: connection reset'));
  if (!failCommit) commit.mockRestore();
  const load = vi
    .spyOn(memoryStore, 'getObservationalMemory')
    .mockRejectedValue(new Error('storage adapter unavailable: read timed out'));
  if (!failLoad) load.mockRestore();
  const agent = new Agent({
    id: 'continue-policy-agent',
    name: 'Continue Policy Agent',
    instructions: 'You are a helpful assistant.',
    model: openai.chat(ACTOR),
    memory: new Memory({
      storage: store,
      options: {
        observationalMemory: {
          enabled: true,
          scope,
          observation: {
            model: observerProvider.chat(OBSERVER),
            messageTokens: 20,
            bufferTokens: false,
            maxRetries: 0,
            failurePolicy,
          },
          reflection: { model: observerProvider.chat(OBSERVER), observationTokens: 100_000 },
        },
      },
    }),
  });

  const result = await agent
    .generate(USER_REQUEST, { memory: { thread: THREAD, resource: RESOURCE } })
    .catch((error: unknown) => ({ error }) as const);

  const commitCalls = commit.mock.calls.length;
  const loadCalls = load.mock.calls.length;
  commit.mockRestore();
  load.mockRestore();
  const { messages } = await memoryStore.listMessages({ threadId: THREAD, perPage: false });
  const record = await memoryStore.getObservationalMemory(scope === 'resource' ? null : THREAD, RESOURCE);
  const observerCalls = mock.getRequests().filter(request => request.body?.model === OBSERVER);
  return {
    result: result as Awaited<ReturnType<typeof agent.generate>>,
    record,
    observerCalls,
    commitCalls,
    loadCalls,
    messages,
  };
}

describe("failurePolicy: 'continue' scope (#27263)", { timeout: 30_000 }, () => {
  describe.each(['thread', 'resource'] as const)('%s scope', scope => {
    it('keeps the turn running when the Observer output stays degenerate after its retry', async () => {
      const { result, record, observerCalls } = await runTurn({
        scope,
        observerReply: { content: degenerateObserverReply },
        failurePolicy: 'continue',
      });

      expect(observerCalls).toHaveLength(2);
      expect(result.tripwire).toBeUndefined();
      expect(result.text).toBe(ACTOR_REPLY);
      expect(record?.lastObservedAt).toBeUndefined();
      expect(record?.activeObservations ?? '').toBe('');
    });

    it("stops the turn on degenerate Observer output under failurePolicy 'abort'", async () => {
      const { result, record } = await runTurn({
        scope,
        observerReply: { content: degenerateObserverReply },
        failurePolicy: 'abort',
      });

      expect(result.text).toBe('');
      expect(result.tripwire?.reason).toContain('degenerate output');
      expect(record?.lastObservedAt).toBeUndefined();
    });

    it.each(['AbortError', 'TimeoutError'] as const)(
      'keeps the turn running when the Observer call rejects with %s and the turn was not cancelled',
      async name => {
        const { result, record } = await runTurn({
          scope,
          failurePolicy: 'continue',
          observerFetch: abortObserverRequests(name),
        });

        expect(result.tripwire).toBeUndefined();
        expect(result.text).toBe(ACTOR_REPLY);
        expect(record?.lastObservedAt).toBeUndefined();
        expect(record?.activeObservations ?? '').toBe('');
      },
    );

    it("stops the turn when the Observer call aborts under failurePolicy 'abort'", async () => {
      const { result, record } = await runTurn({
        scope,
        failurePolicy: 'abort',
        observerFetch: abortObserverRequests('TimeoutError'),
      });

      expect(result.text).toBe('');
      expect(result.tripwire?.reason).toContain('Encountered error during memory observation');
      expect(record?.lastObservedAt).toBeUndefined();
    });

    it('keeps the turn running when the storage adapter rejects the observation commit', async () => {
      const { result, record, commitCalls } = await runTurn({
        scope,
        observerReply: { content: goodObserverReply(scope) },
        failurePolicy: 'continue',
        failCommit: true,
      });

      expect(commitCalls).toBeGreaterThan(0);
      expect(result.tripwire).toBeUndefined();
      expect(result.text).toBe(ACTOR_REPLY);
      expect(record?.lastObservedAt).toBeUndefined();
      expect(record?.activeObservations ?? '').toBe('');
    });

    it("stops the turn when the storage adapter rejects the observation commit under failurePolicy 'abort'", async () => {
      const { result, record } = await runTurn({
        scope,
        observerReply: { content: goodObserverReply(scope) },
        failurePolicy: 'abort',
        failCommit: true,
      });

      expect(result.text).toBe('');
      expect(result.tripwire?.reason).toContain('storage adapter unavailable');
      expect(record?.lastObservedAt).toBeUndefined();
    });

    it('keeps the turn running and saves its messages when the storage adapter rejects the record load', async () => {
      const { result, loadCalls, messages, observerCalls } = await runTurn({
        scope,
        observerReply: { content: goodObserverReply(scope) },
        failurePolicy: 'continue',
        failLoad: true,
      });

      expect(loadCalls).toBeGreaterThan(0);
      expect((result as { error?: unknown }).error).toBeUndefined();
      expect(result.tripwire).toBeUndefined();
      expect(result.text).toBe(ACTOR_REPLY);
      expect(observerCalls).toHaveLength(0);
      const texts = messages.map(message => JSON.stringify(message.content));
      expect(texts.some(text => text.includes('USER_REQUEST_MARKER'))).toBe(true);
      expect(texts.some(text => text.includes(ACTOR_REPLY))).toBe(true);
    });

    it("fails the turn when the storage adapter rejects the record load under failurePolicy 'abort'", async () => {
      const { result } = await runTurn({
        scope,
        observerReply: { content: goodObserverReply(scope) },
        failurePolicy: 'abort',
        failLoad: true,
      });

      expect(result.text ?? '').toBe('');
      const failure = (result as { error?: unknown }).error ?? result.tripwire?.reason ?? result.error;
      expect(String((failure as Error)?.message ?? failure)).toContain('storage adapter unavailable');
    });
  });
});
