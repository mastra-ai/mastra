import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, expect, it } from 'vitest';

import { EventEmitterPubSub } from '../events/event-emitter';
import { Mastra } from '../mastra';
import { MockMemory } from '../memory/mock';
import { InMemoryNotificationsStorage } from '../notifications/storage';
import { MASTRA_RESOURCE_ID_KEY, RequestContext } from '../request-context';
import { MastraCompositeStore } from '../storage/base';
import { Agent } from './agent';
import { threadResourceMismatchError } from './memory-thread-ownership';

const RESOURCE = 'alice';
const MALLORY = 'mallory';

function textChunks(text: string) {
  return [
    { type: 'stream-start', warnings: [] },
    { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
    { type: 'text-start', id: 'text-1' },
    { type: 'text-delta', id: 'text-1', delta: text },
    { type: 'text-end', id: 'text-1' },
    { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
  ] as any[];
}

/** A model that records every prompt; the first call can be held open until `release()`. */
function createRecordingModel({ holdFirst = false } = {}) {
  const prompts: string[] = [];
  let release!: () => void;
  const released = new Promise<void>(resolve => (release = resolve));
  let calls = 0;
  const model = new MockLanguageModelV2({
    doStream: async ({ prompt }) => {
      calls += 1;
      prompts.push(JSON.stringify(prompt));
      if (holdFirst && calls === 1) await released;
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: convertArrayToReadableStream(textChunks('ok')),
      };
    },
  });
  return { model, prompts, release };
}

function callerContext(resourceId?: string, marker?: string) {
  const requestContext = new RequestContext();
  if (resourceId) requestContext.set(MASTRA_RESOURCE_ID_KEY, resourceId);
  if (marker) requestContext.set('marker', marker);
  return requestContext;
}

async function expectMismatch(promise: Promise<unknown>) {
  await expect(promise).rejects.toMatchObject({ id: 'AGENT_MEMORY_THREAD_RESOURCE_MISMATCH', category: 'USER' });
}

function syncCall(fn: () => unknown) {
  return new Promise((resolve, reject) => {
    try {
      resolve(fn());
    } catch (error) {
      reject(error);
    }
  });
}

async function waitFor(check: () => boolean) {
  for (let i = 0; i < 200 && !check(); i++) await new Promise(resolve => setTimeout(resolve, 10));
  if (!check()) throw new Error('condition not reached');
}

describe('threadResourceMismatchError', () => {
  it('keeps the thread wording and details', () => {
    const error = threadResourceMismatchError({
      agentName: 'A',
      threadId: 't1',
      expectedResourceId: 'alice',
      actualResourceId: 'mallory',
    });
    expect(error.id).toBe('AGENT_MEMORY_THREAD_RESOURCE_MISMATCH');
    expect(error.domain).toBe('AGENT');
    expect(error.category).toBe('USER');
    expect(error.message).toBe(
      'Thread "t1" belongs to resource "alice" but resource "mallory" was provided. A thread can only be used by the resource that owns it.',
    );
    expect(Object.keys(error.details ?? {}).sort()).toEqual(
      ['actualResourceId', 'agentName', 'expectedResourceId', 'threadId'].sort(),
    );
  });

  it('names no thread when there is none', () => {
    const error = threadResourceMismatchError({
      agentName: 'A',
      expectedResourceId: 'alice',
      actualResourceId: 'mallory',
    });
    expect(error.id).toBe('AGENT_MEMORY_THREAD_RESOURCE_MISMATCH');
    expect(error.category).toBe('USER');
    expect(error.message).toBe(
      'Resource "mallory" was provided but this session belongs to resource "alice". A thread can only be used by the resource that owns it.',
    );
    expect(error.message).not.toContain('undefined');
    expect(Object.keys(error.details ?? {}).sort()).toEqual(['actualResourceId', 'agentName', 'expectedResourceId']);
  });

  it('names the run when its owner cannot be resolved', () => {
    const error = threadResourceMismatchError({ agentName: 'A', runId: 'r1', actualResourceId: 'mallory' });
    expect(error.id).toBe('AGENT_MEMORY_THREAD_RESOURCE_MISMATCH');
    expect(error.category).toBe('USER');
    expect(error.message).toBe(
      'Resource "mallory" was provided but the resource that owns run "r1" could not be resolved. A thread can only be used by the resource that owns it.',
    );
    expect(error.message).not.toContain('undefined');
    expect(error.message).not.toContain('this session');
    expect(Object.keys(error.details ?? {}).sort()).toEqual(['actualResourceId', 'agentName', 'runId']);
  });
});

describe('Agent send entry points reject a mismatched caller resource', () => {
  async function setup(threadId: string, opts: { holdFirst?: boolean } = {}) {
    const memory = new MockMemory();
    await memory.createThread({ threadId, resourceId: RESOURCE });
    const recorder = createRecordingModel(opts);
    const agent = new Agent({
      id: `guard-${threadId}`,
      name: 'Guard Agent',
      instructions: ({ requestContext }) => `marker:${String(requestContext.get('marker'))}`,
      model: recorder.model,
      memory,
      pubsub: new EventEmitterPubSub(),
    });
    return { agent, memory, ...recorder };
  }

  async function storedText(memory: MockMemory, threadId: string) {
    const { messages } = await memory.recall({ threadId, resourceId: RESOURCE });
    return JSON.stringify(messages);
  }

  it('direct sendSignal with no Session: rejected, absent from the next prompt and from storage', async () => {
    const threadId = 'direct-signal';
    const { agent, memory, prompts } = await setup(threadId);

    await expectMismatch(
      syncCall(() =>
        agent.sendSignal(
          { type: 'user-message', contents: 'MALLORY-SECRET' },
          { resourceId: RESOURCE, threadId, requestContext: callerContext(MALLORY) },
        ),
      ),
    );

    const ok = agent.sendSignal(
      { type: 'user-message', contents: 'alice hello' },
      { resourceId: RESOURCE, threadId, requestContext: callerContext(RESOURCE) },
    );
    const accepted = await ok.accepted;
    if (accepted.action === 'wake') await accepted.output.text;

    expect(prompts.length).toBeGreaterThan(0);
    expect(prompts.join('\n')).toContain('alice hello');
    expect(prompts.join('\n')).not.toContain('MALLORY-SECRET');
    expect(await storedText(memory, threadId)).not.toContain('MALLORY-SECRET');
  });

  it('sendMessage: rejected, not delivered', async () => {
    const threadId = 'send-message';
    const { agent, memory, prompts } = await setup(threadId);
    await expectMismatch(
      syncCall(() =>
        agent.sendMessage(
          { contents: 'MALLORY-SECRET' },
          { resourceId: RESOURCE, threadId, requestContext: callerContext(MALLORY) },
        ),
      ),
    );
    expect(prompts).toHaveLength(0);
    expect(await storedText(memory, threadId)).not.toContain('MALLORY-SECRET');
  });

  it('queueMessage: rejected, nothing queued', async () => {
    const threadId = 'queue-message';
    const { agent, memory, prompts } = await setup(threadId);
    await expectMismatch(
      syncCall(() =>
        agent.queueMessage('MALLORY-SECRET', {
          resourceId: RESOURCE,
          threadId,
          requestContext: callerContext(MALLORY),
        }),
      ),
    );
    expect(prompts).toHaveLength(0);
    expect(await storedText(memory, threadId)).not.toContain('MALLORY-SECRET');
  });

  it('sendStateSignal: rejected, no memory write', async () => {
    const threadId = 'state-signal';
    const { agent, memory } = await setup(threadId);
    await expectMismatch(
      syncCall(() =>
        agent.sendStateSignal(
          { id: 'browser', cacheKey: 'browser:v1', mode: 'snapshot', contents: 'MALLORY-SECRET', value: { url: 'x' } },
          { resourceId: RESOURCE, threadId, requestContext: callerContext(MALLORY), ifIdle: { behavior: 'persist' } },
        ),
      ),
    );
    expect(await storedText(memory, threadId)).not.toContain('MALLORY-SECRET');
  });

  it('sendNotificationSignal: rejected with no record; a policy context is not checked', async () => {
    const notifications = new InMemoryNotificationsStorage();
    const storage = new MastraCompositeStore({ id: 'guard-notifications', domains: { notifications } });
    const policyContext = callerContext(MALLORY);
    const recorder = createRecordingModel();
    const agent = new Agent({
      id: 'guard-notification-agent',
      name: 'Guard Notification Agent',
      instructions: 'Test',
      model: recorder.model,
      notifications: {
        deliveryPolicy: { decide: () => ({ action: 'deliver', streamOptions: { requestContext: policyContext } }) },
      },
    });
    new Mastra({ agents: { guardNotificationAgent: agent }, storage, logger: false });
    const threadId = 'notification-thread';

    await expectMismatch(
      agent.sendNotificationSignal(
        { source: 'ci', kind: 'status', priority: 'medium', summary: 'MALLORY-SECRET' },
        { resourceId: RESOURCE, threadId, requestContext: callerContext(MALLORY) },
      ),
    );
    expect(await notifications.listNotifications({ threadId })).toHaveLength(0);

    const delivered = await agent.sendNotificationSignal(
      { source: 'ci', kind: 'status', priority: 'medium', summary: 'policy ok' },
      { resourceId: RESOURCE, threadId },
    );
    expect(delivered.record).toMatchObject({ status: 'delivered' });
    const accepted = await delivered.accepted;
    if (accepted?.action === 'wake') await accepted.output.text;
  });

  it('accepts a matching key and no key at all', async () => {
    const threadId = 'accepts';
    const { agent } = await setup(threadId);
    for (const requestContext of [callerContext(RESOURCE), callerContext(), undefined]) {
      const result = agent.sendSignal(
        { type: 'user-message', contents: 'fine' },
        { resourceId: RESOURCE, threadId, requestContext },
      );
      const accepted = await result.accepted;
      if (accepted.action === 'wake') await accepted.output.text;
    }
  });

  it('checks only the top-level context: ifIdle is the fallback, never the caller identity', async () => {
    const threadId = 'precedence';
    const { agent, memory, prompts } = await setup(threadId);

    const ok = agent.sendSignal(
      { type: 'user-message', contents: 'top wins' },
      {
        resourceId: RESOURCE,
        threadId,
        requestContext: callerContext(RESOURCE, 'top'),
        ifIdle: { streamOptions: { requestContext: callerContext(MALLORY, 'nested') } },
      },
    );
    const accepted = await ok.accepted;
    if (accepted.action === 'wake') await accepted.output.text;
    expect(prompts.at(-1)).toContain('marker:top');

    await expectMismatch(
      syncCall(() =>
        agent.sendSignal(
          { type: 'user-message', contents: 'rejected' },
          {
            resourceId: RESOURCE,
            threadId,
            requestContext: callerContext(MALLORY),
            ifIdle: { streamOptions: { requestContext: callerContext(RESOURCE) } },
          },
        ),
      ),
    );

    const nestedThreadId = 'precedence-nested';
    await memory.createThread({ threadId: nestedThreadId, resourceId: RESOURCE });
    const nestedOnly = agent.sendSignal(
      { type: 'user-message', contents: 'nested only' },
      {
        resourceId: RESOURCE,
        threadId: nestedThreadId,
        ifIdle: { streamOptions: { requestContext: callerContext(MALLORY, 'nested') } },
      },
    );
    // The entry point does not check ifIdle (no synchronous throw); the woken run's memory step rejects it, as before.
    await expect(nestedOnly.accepted).rejects.toThrow(/belongs to resource "alice"/);
  });

  it('runId-only sendSignal and queueMessage against a live run of another resource are rejected', async () => {
    const threadId = 'run-id-only';
    const { agent, prompts, release } = await setup(threadId, { holdFirst: true });
    const subscription = await agent.subscribeToThread({ threadId, resourceId: RESOURCE });
    const stream = await agent.stream('alice starts', { memory: { thread: threadId, resource: RESOURCE } });
    try {
      await waitFor(() => prompts.length === 1);
      await expectMismatch(
        syncCall(() =>
          agent.sendSignal(
            { type: 'user-message', contents: 'MALLORY-SECRET' },
            { runId: stream.runId, requestContext: callerContext(MALLORY) },
          ),
        ),
      );
      await expectMismatch(
        syncCall(() =>
          agent.queueMessage('MALLORY-QUEUED', { runId: stream.runId, requestContext: callerContext(MALLORY) }),
        ),
      );
    } finally {
      release();
    }
    await stream.text;
    await new Promise(resolve => setTimeout(resolve, 0));
    subscription.unsubscribe();
    expect(prompts.join('\n')).not.toContain('MALLORY-SECRET');
    expect(prompts.join('\n')).not.toContain('MALLORY-QUEUED');
  });

  it('a queued message never inherits the active run’s requestContext', async () => {
    const threadId = 'queued-context';
    const { agent, prompts, release } = await setup(threadId, { holdFirst: true });
    const subscription = await agent.subscribeToThread({ threadId, resourceId: RESOURCE });
    const stream = await agent.stream('alice starts', {
      memory: { thread: threadId, resource: RESOURCE },
      requestContext: callerContext(RESOURCE, 'active-run'),
    });
    const callerIfIdle = { streamOptions: {} as Record<string, unknown> };
    try {
      await waitFor(() => prompts.length === 1);
      agent.queueMessage('queued with context', {
        resourceId: RESOURCE,
        threadId,
        requestContext: callerContext(RESOURCE, 'queued-caller'),
      });
      agent.queueMessage('queued without context', { resourceId: RESOURCE, threadId, ifIdle: callerIfIdle as any });
    } finally {
      release();
    }
    await stream.text;
    await waitFor(() => prompts.length >= 3);
    subscription.unsubscribe();

    expect(prompts[0]).toContain('marker:active-run');
    expect(prompts[1]).toContain('marker:queued-caller');
    expect(prompts[1]).toContain('queued with context');
    expect(prompts[2]).toContain('marker:undefined');
    expect(prompts[2]).toContain('queued without context');
    expect(callerIfIdle.streamOptions).toEqual({});
  });
});
