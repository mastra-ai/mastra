/**
 * Observer replies with text but no observations (#27260)
 *
 * A reply such as "I can't help with that" has text, so it passes the empty-output
 * check, but it parses to zero observations. Committing it would advance the cursor
 * past messages that were never observed. It must be retried with the same budget as
 * an empty reply, and once retries run out `failurePolicy` decides the turn.
 *
 * A reply that carries only other recognised sections (current-task, etc.) is valid.
 * In a multi-thread reply, a thread the Observer left out keeps its cursor so its
 * messages are observed in a later cycle.
 *
 * Runs a real Agent + Memory turn with a real OpenAI provider pointed at AIMock for
 * both the actor and the Observer. Thread scope exercises the single-thread Observer;
 * resource scope exercises the multi-thread Observer.
 */

import { createOpenAI } from '@ai-sdk/openai-v5';
import { LLMock } from '@copilotkit/aimock';
import type { FixtureResponse } from '@copilotkit/aimock';
import { Agent } from '@mastra/core/agent';
import type { MastraDBMessage } from '@mastra/core/agent';
import { getThreadOMMetadata } from '@mastra/core/memory';
import { InMemoryStore } from '@mastra/core/storage';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { Memory } from '../../../index';
import { ObservationalMemory } from '../observational-memory';
import { RETRY_CONFIG } from '../retry';

const ACTOR = 'actor-model';
const OBSERVER = 'observer-model';
const THREAD = 'refusal-observer-thread';
const OTHER_THREAD = 'refusal-observer-other-thread';
const RESOURCE = 'refusal-observer-resource';
const USER_REQUEST = `USER_REQUEST_MARKER: plan the billing database migration. ${'It must have zero downtime. '.repeat(10)}`;
const OTHER_THREAD_MARKER = 'OTHER_THREAD_MARKER';
const ACTOR_REPLY = 'Here is a migration plan.';
const REFUSAL = "I'm sorry, but I can't help with that.";
const OBSERVATION = '* 🔴 User is planning a zero-downtime billing database migration';
const OTHER_OBSERVATION = '* 🟡 User asked about invoice export formats';

const goodObserverReply = (scope: 'thread' | 'resource') =>
  scope === 'thread'
    ? `<observations>\n${OBSERVATION}\n</observations>`
    : `<observations>\n<thread id="${THREAD}">\n${OBSERVATION}\n</thread>\n</observations>`;

const currentTaskOnlyReply = (scope: 'thread' | 'resource') =>
  scope === 'thread'
    ? `<current-task>\nPlan the billing database migration\n</current-task>`
    : `<observations>\n<thread id="${THREAD}">\n<current-task>\nPlan the billing database migration\n</current-task>\n</thread>\n</observations>`;

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

function setup({
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
  const memory = new Memory({
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
  });
  const agent = new Agent({
    id: 'refusal-observer-agent',
    name: 'Refusal Observer Agent',
    instructions: 'You are a helpful assistant.',
    model: openai.chat(ACTOR),
    memory,
  });

  const read = async () => {
    const memoryStore = (await store.getStore('memory'))!;
    const record = await memoryStore.getObservationalMemory(scope === 'resource' ? null : THREAD, RESOURCE);
    const observerCalls = mock.getRequests().filter(request => request.body?.model === OBSERVER);
    return { memoryStore, record, observerCalls };
  };

  return { agent, memory, read };
}

async function runTurn(opts: Parameters<typeof setup>[0]) {
  const { agent, read } = setup(opts);
  const result = await agent.generate(USER_REQUEST, { memory: { thread: THREAD, resource: RESOURCE } });
  return { result, ...(await read()) };
}

describe('Observer reply with text but no observations', { timeout: 30_000 }, () => {
  describe.each(['thread', 'resource'] as const)('%s scope', scope => {
    it('does not advance lastObservedAt when the Observer refuses', async () => {
      const { result, record, observerCalls } = await runTurn({
        scope,
        observerReplies: [{ content: REFUSAL }],
        maxRetries: 0,
        failurePolicy: 'continue',
      });

      expect(observerCalls).toHaveLength(1);
      expect(result.tripwire).toBeUndefined();
      expect(result.text).toBe(ACTOR_REPLY);
      expect(record?.lastObservedAt).toBeUndefined();
      expect(record?.activeObservations ?? '').toBe('');
    });

    it('retries a refusal and observes the messages from the next good reply', async () => {
      const { result, record, observerCalls } = await runTurn({
        scope,
        observerReplies: [{ content: REFUSAL }, { content: goodObserverReply(scope) }],
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
        observerReplies: [{ content: REFUSAL }],
        maxRetries: 1,
        failurePolicy: 'abort',
      });

      expect(observerCalls).toHaveLength(2);
      expect(result.text).toBe('');
      expect(result.tripwire?.reason).toContain('Encountered error during memory observation');
      expect(result.tripwire?.reason).toContain('returned no observations');
      expect(record?.lastObservedAt).toBeUndefined();
      expect(record?.activeObservations ?? '').toBe('');
    });

    it('commits a reply that carries only a current-task section without retrying', async () => {
      const { result, record, observerCalls } = await runTurn({
        scope,
        observerReplies: [{ content: currentTaskOnlyReply(scope) }],
        maxRetries: 1,
        failurePolicy: 'abort',
      });

      expect(observerCalls).toHaveLength(1);
      expect(result.tripwire).toBeUndefined();
      expect(result.text).toBe(ACTOR_REPLY);
      expect(record?.lastObservedAt).toBeInstanceOf(Date);
    });
  });

  it('thread scope: commits a reply whose sections put tag and content on one line', async () => {
    const { result, record, observerCalls, memoryStore } = await runTurn({
      scope: 'thread',
      observerReplies: [
        {
          content: `<observations>${OBSERVATION}</observations>\n<current-task>Plan the billing database migration</current-task>`,
        },
      ],
      maxRetries: 1,
      failurePolicy: 'abort',
    });

    expect(observerCalls).toHaveLength(1);
    expect(result.tripwire).toBeUndefined();
    expect(record?.lastObservedAt).toBeInstanceOf(Date);
    expect(record?.activeObservations).toContain(OBSERVATION);
    const thread = await memoryStore.getThreadById({ threadId: THREAD });
    expect(getThreadOMMetadata(thread?.metadata)?.currentTask).toBe('Plan the billing database migration');
  });

  it('thread scope: commits a reply carrying only a one-line current-task section', async () => {
    const { result, record, observerCalls } = await runTurn({
      scope: 'thread',
      observerReplies: [{ content: '<current-task>Plan the billing database migration</current-task>' }],
      maxRetries: 1,
      failurePolicy: 'abort',
    });

    expect(observerCalls).toHaveLength(1);
    expect(result.tripwire).toBeUndefined();
    expect(record?.lastObservedAt).toBeInstanceOf(Date);
  });

  it('resource scope: keeps the cursor of a thread the reply left out and observes it next cycle', async () => {
    const replyForThreadOnly = goodObserverReply('resource');
    const replyForOtherThread = `<observations>\n<thread id="${OTHER_THREAD}">\n${OTHER_OBSERVATION}\n</thread>\n</observations>`;
    mock.on({ endpoint: 'chat', model: OBSERVER, sequenceIndex: 0 }, { content: replyForThreadOnly });
    mock.on({ endpoint: 'chat', model: OBSERVER }, { content: replyForOtherThread });

    const openai = createOpenAI({ apiKey: 'test-key', baseURL: `${mock.url}/v1` });
    const memoryStore = (await new InMemoryStore().getStore('memory'))!;
    const om = new ObservationalMemory({
      storage: memoryStore,
      scope: 'resource',
      observation: {
        model: openai.chat(OBSERVER),
        messageTokens: 100_000,
        bufferTokens: false,
        maxRetries: 0,
        failurePolicy: 'abort',
      },
      reflection: { model: openai.chat(OBSERVER), observationTokens: 100_000 },
    });

    const base = Date.now() - 60_000;
    const message = (id: string, threadId: string, role: 'user' | 'assistant', text: string, offsetMs: number) =>
      ({
        id,
        role,
        threadId,
        resourceId: RESOURCE,
        createdAt: new Date(base + offsetMs),
        content: { format: 2, parts: [{ type: 'text', text }] },
      }) satisfies MastraDBMessage;
    for (const id of [THREAD, OTHER_THREAD]) {
      await memoryStore.saveThread({
        thread: {
          id,
          resourceId: RESOURCE,
          title: '',
          metadata: {},
          createdAt: new Date(base),
          updatedAt: new Date(base),
        },
      });
    }
    const threadMessages = [
      message('thread-user', THREAD, 'user', USER_REQUEST, 2_000),
      message('thread-assistant', THREAD, 'assistant', ACTOR_REPLY, 3_000),
    ];
    await memoryStore.saveMessages({
      messages: [
        message(
          'other-user',
          OTHER_THREAD,
          'user',
          `${OTHER_THREAD_MARKER}: which invoice export formats do you support?`,
          0,
        ),
        message('other-assistant', OTHER_THREAD, 'assistant', 'CSV and PDF.', 1_000),
        ...threadMessages,
      ],
    });
    const otherThreadCursor = async () =>
      getThreadOMMetadata((await memoryStore.getThreadById({ threadId: OTHER_THREAD }))?.metadata)?.lastObservedAt;
    const observerCalls = () => mock.getRequests().filter(request => request.body?.model === OBSERVER);

    const first = await om.observe({ threadId: THREAD, resourceId: RESOURCE, messages: threadMessages, force: true });

    expect(first.observed).toBe(true);
    expect(observerCalls()).toHaveLength(1);
    const firstRequest = JSON.stringify(observerCalls()[0]!.body.messages);
    expect(firstRequest).toContain(`<thread id=\\"${OTHER_THREAD}\\">`);
    expect(firstRequest).toContain(OTHER_THREAD_MARKER);
    expect(first.record.activeObservations).toContain('zero-downtime billing database migration');
    expect(first.record.activeObservations).not.toContain('invoice export formats');
    expect(await otherThreadCursor()).toBeUndefined();

    // The next cycle starts when the thread gets a new message.
    const followUp = message('thread-follow-up', THREAD, 'user', 'Thanks, go ahead.', 30_000);
    await memoryStore.saveMessages({ messages: [followUp] });
    const second = await om.observe({ threadId: THREAD, resourceId: RESOURCE, messages: [followUp], force: true });

    expect(second.observed).toBe(true);
    expect(observerCalls()).toHaveLength(2);
    const secondRequest = JSON.stringify(observerCalls()[1]!.body.messages);
    expect(secondRequest).toContain(OTHER_THREAD_MARKER);
    expect(secondRequest).not.toContain('USER_REQUEST_MARKER');
    expect(second.record.activeObservations).toContain('invoice export formats');
    expect(await otherThreadCursor()).toBeDefined();
  });
});
