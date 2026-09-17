import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it, vi } from 'vitest';
import { InMemoryServerCache } from '../cache/inmemory';
import { CachingPubSub } from '../events/caching-pubsub';
import { EventEmitterPubSub } from '../events/event-emitter';
import { MASTRA_VERSIONS_KEY, RequestContext } from '../request-context';
import { Agent } from './agent';
import { LeasePubSub } from './__tests__/thread-stream-test-utils';
import { AgentThreadStreamRuntime, agentThreadStreamRuntime } from './thread-stream-runtime';
import { getAgentVersionPins, setAgentVersionPins } from './version-pins';
import type { AgentVersionPins } from './version-pins';

// Unlike CachingPubSub's per-process cache, this transport really removes all
// controls and stream parts correlated with a completed run when it is trimmed.
class RetainedVersionPubSub extends LeasePubSub {
  override getHistory(topic: string) {
    return Promise.resolve(this.retainedEvents(topic));
  }
}

async function completedRetainedRun(versionPins?: AgentVersionPins) {
  const origin = new AgentThreadStreamRuntime();
  const pubsub = new RetainedVersionPubSub();
  pubsub.retain = true;
  const requestContext = new RequestContext();
  if (versionPins) setAgentVersionPins(requestContext, versionPins);
  let finish!: () => void;
  const finished = new Promise<void>(resolve => (finish = resolve));
  const output = {
    ...completedOutput('retained-source'),
    status: 'running',
    _waitUntilFinished: () => finished,
  };
  const agent = { id: 'stored-agent', getMemory: async () => ({}) } as unknown as Agent<any, any, any, any>;
  await origin.registerRun(
    agent,
    output as any,
    { requestContext, memory: { thread: 'trimmed-thread', resource: 'resource' } } as any,
    pubsub,
  );
  output.status = 'success';
  finish();
  const topic = `agent.thread-stream.${encodeURIComponent('resource\u0000trimmed-thread')}`;
  await vi.waitFor(() => {
    const events = pubsub.retainedEvents(topic);
    expect(events.some(event => event.data?.type === 'run-version-identity')).toBe(true);
    expect(events.some(event => event.runId === output.runId)).toBe(false);
  });
  return { pubsub, topic, sourceRunId: output.runId };
}

function completedOutput(runId: string) {
  return {
    runId,
    status: 'success',
    fullStream: new ReadableStream({
      start(controller) {
        controller.close();
      },
    }),
    _waitUntilFinished: () => Promise.resolve(),
  } as any;
}

function outputWithParts(runId: string, parts: unknown[]) {
  let finish!: () => void;
  const finished = new Promise<void>(resolve => {
    finish = resolve;
  });
  return {
    runId,
    status: 'success',
    fullStream: new ReadableStream({
      start(controller) {
        for (const part of parts) controller.enqueue(part);
        controller.close();
        finish();
      },
    }),
    _waitUntilFinished: () => finished,
  } as any;
}

describe('thread stream version pins', () => {
  it.each([
    {
      name: 'a stored root and dependency',
      pins: {
        root: { agentId: 'stored-agent', versionId: 'v1', selectedLabel: 'production' },
        agents: { dependency: { agentId: 'dependency', versionId: 'dep-v1', selectedLabel: 'stable' } },
      },
      versions: { self: { versionId: 'v1' }, agents: { dependency: { versionId: 'dep-v1' } } },
    },
    {
      name: 'a rootless dependency selection',
      pins: { agents: { dependency: { agentId: 'dependency', versionId: 'dep-v1', selectedLabel: 'stable' } } },
      versions: { agents: { dependency: { versionId: 'dep-v1' } } },
    },
    { name: 'an entirely unversioned root', pins: undefined, versions: undefined },
  ])('retains only the identity of $name after saved message history is trimmed', async ({ pins, versions }) => {
    const { pubsub, topic, sourceRunId } = await completedRetainedRun(pins);
    const events = pubsub.retainedEvents(topic);
    expect(events).toHaveLength(1);
    expect(events[0].data).toMatchObject({
      type: 'run-version-identity',
      sourceRunId,
      agentId: 'stored-agent',
      expiresAt: expect.any(Number),
    });
    expect(events[0].data).not.toHaveProperty('part');
    expect(events[0].runId).not.toBe(sourceRunId);

    // A fresh runtime has no warm run record or pin map to hide lost history.
    const remote = new AgentThreadStreamRuntime();
    const hydrated = await remote.hydrateThreadRunVersionPins(
      { agentId: 'stored-agent', runId: sourceRunId, threadId: 'trimmed-thread', resourceId: 'resource' },
      pubsub,
    );
    expect(hydrated).toEqual({ runId: sourceRunId, versionPins: pins });
    await expect(
      remote.hydrateThreadRunVersionPins(
        { agentId: 'stored-agent', threadId: 'trimmed-thread', resourceId: 'resource' },
        pubsub,
      ),
    ).resolves.toEqual(hydrated);
    const stream = vi.fn(async (_messages: unknown, options: any) => completedOutput(options.runId));
    const agent = { id: 'stored-agent', stream } as unknown as Agent<any, any, any, any>;
    remote.continueWithMessages(
      agent,
      'approved after Production moved to v2',
      {
        sourceRunId,
        sourceVersionPins: hydrated?.versionPins,
        threadId: 'trimmed-thread',
        resourceId: 'resource',
      },
      pubsub,
    );
    await vi.waitFor(() => expect(stream).toHaveBeenCalledOnce());
    expect(stream.mock.calls[0]?.[1]?.versions).toEqual(versions);
  });

  it('rejects expired and missing completed identities without falling back to a new Production selection', async () => {
    const { pubsub, topic, sourceRunId } = await completedRetainedRun({
      root: { agentId: 'stored-agent', versionId: 'v1', selectedLabel: 'production' },
    });
    const remote = new AgentThreadStreamRuntime();
    const options = { agentId: 'stored-agent', threadId: 'trimmed-thread', resourceId: 'resource' };
    const expiresAt = pubsub.retainedEvents(topic)[0].data.expiresAt;
    const now = vi.spyOn(Date, 'now').mockReturnValue(expiresAt);
    try {
      await expect(
        remote.hydrateThreadRunVersionPins({ ...options, runId: sourceRunId }, pubsub),
      ).rejects.toMatchObject({
        id: 'PINNED_VERSION_REQUIRED',
      });
      await expect(remote.hydrateThreadRunVersionPins(options, pubsub)).rejects.toMatchObject({
        id: 'PINNED_VERSION_REQUIRED',
      });
    } finally {
      now.mockRestore();
    }
    await pubsub.trimTopic(topic, { runId: pubsub.retainedEvents(topic)[0].runId });
    await expect(remote.hydrateThreadRunVersionPins(options, pubsub)).rejects.toMatchObject({
      id: 'PINNED_VERSION_REQUIRED',
    });
  });

  it('verifies the owning agent even when a retained completed identity has no version selections', async () => {
    const { pubsub, sourceRunId } = await completedRetainedRun();
    await expect(
      new AgentThreadStreamRuntime().hydrateThreadRunVersionPins(
        { agentId: 'different-agent', runId: sourceRunId, threadId: 'trimmed-thread', resourceId: 'resource' },
        pubsub,
      ),
    ).rejects.toMatchObject({ id: 'PINNED_VERSION_INVALID' });
  });

  it('removes compact completed identities after the five-minute continuation window', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout'] });
    try {
      const { pubsub, topic } = await completedRetainedRun();
      expect(pubsub.retainedEvents(topic)).toHaveLength(1);
      await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
      expect(pubsub.retainedEvents(topic)).toEqual([]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not expire the immutable identity of a still-active run', async () => {
    const runtime = new AgentThreadStreamRuntime();
    const pubsub = new EventEmitterPubSub();
    const requestContext = new RequestContext();
    const pins = { root: { agentId: 'stored-agent', versionId: 'v1', selectedLabel: 'production' } };
    setAgentVersionPins(requestContext, pins);
    let finish!: () => void;
    const finished = new Promise<void>(resolve => (finish = resolve));
    const agent = { id: 'stored-agent' } as unknown as Agent<any, any, any, any>;
    await runtime.registerRun(
      agent,
      { ...completedOutput('still-active'), status: 'running', _waitUntilFinished: () => finished } as any,
      { requestContext, memory: { thread: 'active-thread', resource: 'resource' } } as any,
      pubsub,
    );
    const now = vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 6 * 60 * 1000);
    try {
      await expect(
        runtime.hydrateThreadRunVersionPins(
          { agentId: 'stored-agent', runId: 'still-active', threadId: 'active-thread', resourceId: 'resource' },
          pubsub,
        ),
      ).resolves.toEqual({ runId: 'still-active', versionPins: pins });
    } finally {
      now.mockRestore();
      finish();
    }
  });

  it('broadcasts the resolved run identity before the first stream part on the thread topic', async () => {
    const runtime = new AgentThreadStreamRuntime();
    const pubsub = new EventEmitterPubSub();
    const requestContext = new RequestContext();
    setAgentVersionPins(requestContext, {
      root: { agentId: 'stored-agent', versionId: 'v1', selectedLabel: 'pr-101' },
      defaultStatus: 'published',
    });

    const key = ['resource', 'thread'].join('\0');
    const topic = `agent.thread-stream.${encodeURIComponent(key)}`;
    const parts: unknown[] = [];
    await pubsub.subscribe(topic, async event => {
      const data = (event as { data?: { type?: string; part?: unknown } }).data;
      if (data?.type === 'stream-part') parts.push(data.part);
    });

    const agent = { id: 'stored-agent' } as unknown as Agent<any, any, any, any>;
    runtime.registerRun(
      agent,
      outputWithParts('run-identity', [{ type: 'text-delta', payload: { text: 'hello' } }]),
      { requestContext, memory: { thread: 'thread', resource: 'resource' } } as any,
      pubsub,
    );

    await vi.waitFor(() => expect(parts.length).toBeGreaterThanOrEqual(2));
    // Subscribers get the immutable identity first, exactly as direct-stream
    // callers do — exact selections only, never the requested label text or a
    // per-caller continuation token.
    expect(parts[0]).toEqual({
      type: 'resolved-version-overrides',
      payload: { defaultStatus: 'published', self: { versionId: 'v1' } },
    });
    expect(parts[1]).toMatchObject({ type: 'text-delta' });
    expect(JSON.stringify(parts[0])).not.toContain('pr-101');
    expect(JSON.stringify(parts[0])).not.toContain('versionContinuationToken');
  });

  it('does not broadcast a version identity for an unversioned run', async () => {
    const runtime = new AgentThreadStreamRuntime();
    const pubsub = new EventEmitterPubSub();

    const key = ['resource', 'unversioned-thread'].join('\0');
    const topic = `agent.thread-stream.${encodeURIComponent(key)}`;
    const parts: unknown[] = [];
    await pubsub.subscribe(topic, async event => {
      const data = (event as { data?: { type?: string; part?: unknown } }).data;
      if (data?.type === 'stream-part') parts.push(data.part);
    });

    const agent = { id: 'stored-agent' } as unknown as Agent<any, any, any, any>;
    runtime.registerRun(
      agent,
      outputWithParts('run-unversioned', [{ type: 'text-delta', payload: { text: 'hello' } }]),
      { requestContext: new RequestContext(), memory: { thread: 'unversioned-thread', resource: 'resource' } } as any,
      pubsub,
    );

    await vi.waitFor(() => expect(parts.length).toBeGreaterThanOrEqual(1));
    expect(parts[0]).toMatchObject({ type: 'text-delta' });
    expect(parts.some(part => (part as { type?: string })?.type === 'resolved-version-overrides')).toBe(false);
  });

  it('continues a client-tool approval on the active run exact version after its label moves', async () => {
    const runtime = new AgentThreadStreamRuntime();
    const pubsub = new EventEmitterPubSub();
    const requestContext = new RequestContext();
    setAgentVersionPins(requestContext, {
      root: { agentId: 'stored-agent', versionId: 'v1', selectedLabel: 'production' },
      agents: { dependency: { agentId: 'dependency', versionId: 'dep-v1', selectedLabel: 'stable' } },
      defaultStatus: 'published',
    });
    requestContext.set(MASTRA_VERSIONS_KEY, {
      self: { label: 'production' },
      agents: { dependency: { label: 'stable' } },
    });

    let labelTarget = 'v1';
    const selectedVersions: string[] = [];
    const stream = vi.fn(async (_messages: unknown, options: any) => {
      const selector = options.versions.self;
      selectedVersions.push('versionId' in selector ? selector.versionId : labelTarget);
      return completedOutput(options.runId);
    });
    const agent = { id: 'stored-agent', stream } as unknown as Agent<any, any, any, any>;
    const threadId = 'thread';
    const resourceId = 'resource';
    let finishActive!: () => void;
    const activeFinished = new Promise<void>(resolve => {
      finishActive = resolve;
    });
    runtime.registerRun(
      agent,
      {
        ...completedOutput('run-v1'),
        _waitUntilFinished: () => activeFinished,
      },
      { requestContext, memory: { thread: threadId, resource: resourceId } } as any,
      pubsub,
    );

    const continuation = runtime.continueWithMessages(
      agent,
      [{ role: 'tool', content: [{ type: 'tool-result', toolCallId: 'call', toolName: 'client', output: 'ok' }] }],
      { threadId, resourceId },
      pubsub,
    );
    labelTarget = 'v2';
    finishActive();

    await vi.waitFor(() => expect(stream).toHaveBeenCalledOnce());
    const continuationOptions = stream.mock.calls[0]?.[1];
    expect(continuationOptions).toMatchObject({
      runId: continuation.runId,
      versions: {
        defaultStatus: 'published',
        self: { versionId: 'v1' },
        agents: { dependency: { versionId: 'dep-v1' } },
      },
    });
    expect(getAgentVersionPins(continuationOptions.requestContext)).toEqual({
      root: { agentId: 'stored-agent', versionId: 'v1', selectedLabel: 'production' },
      agents: { dependency: { agentId: 'dependency', versionId: 'dep-v1', selectedLabel: 'stable' } },
      defaultStatus: 'published',
    });
    expect(selectedVersions).toEqual(['v1']);
  });

  it('rehydrates exact pins from shared pubsub history before a remote client-tool continuation', async () => {
    const origin = new AgentThreadStreamRuntime();
    const remote = new AgentThreadStreamRuntime();
    const pubsub = new CachingPubSub(new EventEmitterPubSub(), new InMemoryServerCache());
    const requestContext = new RequestContext();
    setAgentVersionPins(requestContext, {
      root: { agentId: 'stored-agent', versionId: 'v1', selectedLabel: 'production' },
      agents: { dependency: { agentId: 'dependency', versionId: 'dep-v1', selectedLabel: 'stable' } },
      defaultStatus: 'published',
    });
    let labelTarget = 'v1';

    let finishOrigin!: () => void;
    const originFinished = new Promise<void>(resolve => {
      finishOrigin = resolve;
    });
    const originAgent = { id: 'stored-agent', stream: vi.fn() } as unknown as Agent<any, any, any, any>;
    const originOutput = {
      ...completedOutput('remote-run'),
      status: 'running',
      _waitUntilFinished: () => originFinished,
    } as any;
    await origin.registerRun(
      originAgent,
      originOutput,
      { requestContext, memory: { thread: 'thread', resource: 'resource' } } as any,
      pubsub,
    );

    originOutput.status = 'success';
    finishOrigin();
    labelTarget = 'v2';
    const topic = `agent.thread-stream.${encodeURIComponent('resource\u0000thread')}`;
    await vi.waitFor(async () => {
      expect((await pubsub.getHistory(topic)).some(event => event.data?.type === 'run-completed')).toBe(true);
    });
    const hydrated = await remote.hydrateThreadRunVersionPins(
      { agentId: 'stored-agent', runId: 'remote-run', threadId: 'thread', resourceId: 'resource' },
      pubsub,
    );
    expect(hydrated).toMatchObject({
      runId: 'remote-run',
      versionPins: { root: { versionId: 'v1' }, agents: { dependency: { versionId: 'dep-v1' } } },
    });

    const selectedVersions: string[] = [];
    const stream = vi.fn(async (_messages: unknown, options: any) => {
      const selector = options.versions.self;
      selectedVersions.push('versionId' in selector ? selector.versionId : labelTarget);
      return completedOutput(options.runId);
    });
    const remoteAgent = { id: 'stored-agent', stream } as unknown as Agent<any, any, any, any>;
    remote.continueWithMessages(
      remoteAgent,
      'approved',
      {
        runId: 'remote-continuation',
        sourceRunId: 'remote-run',
        sourceVersionPins: hydrated?.versionPins,
        threadId: 'thread',
        resourceId: 'resource',
      },
      pubsub,
    );

    await vi.waitFor(() => expect(stream).toHaveBeenCalledOnce());
    expect(stream.mock.calls[0]?.[1]).toMatchObject({
      runId: 'remote-continuation',
      versions: {
        defaultStatus: 'published',
        self: { versionId: 'v1' },
        agents: { dependency: { versionId: 'dep-v1' } },
      },
    });
    expect(selectedVersions).toEqual(['v1']);
  });

  it('rejects retained history that lists the continuing agent as a rootless dependency', async () => {
    const remote = new AgentThreadStreamRuntime();
    const pubsub = new CachingPubSub(new EventEmitterPubSub(), new InMemoryServerCache());
    const topic = `agent.thread-stream.${encodeURIComponent('resource\u0000thread')}`;
    await pubsub.publish(topic, {
      type: 'run-registered',
      runId: 'malformed-owner-run',
      data: {
        type: 'run-registered',
        runId: 'malformed-owner-run',
        streamId: 'malformed-owner-stream',
        streamSeq: 0,
        versionPins: {
          agents: { 'stored-agent': { agentId: 'stored-agent', versionId: 'v1' } },
        },
      },
    });

    await expect(
      remote.hydrateThreadRunVersionPins(
        { agentId: 'stored-agent', runId: 'malformed-owner-run', threadId: 'thread', resourceId: 'resource' },
        pubsub,
      ),
    ).rejects.toMatchObject({ id: 'PINNED_VERSION_INVALID' });
  });

  it('rejects conflicting registration and completion pins retained for the same source run', async () => {
    const remote = new AgentThreadStreamRuntime();
    const pubsub = new CachingPubSub(new EventEmitterPubSub(), new InMemoryServerCache());
    const topic = `agent.thread-stream.${encodeURIComponent('resource\u0000thread')}`;
    await pubsub.publish(topic, {
      type: 'run-registered',
      runId: 'conflicting-history-run',
      data: {
        type: 'run-registered',
        runId: 'conflicting-history-run',
        streamId: 'conflicting-history-stream',
        streamSeq: 0,
        versionPins: {
          root: { agentId: 'stored-agent', versionId: 'v1', selectedLabel: 'production' },
        },
      },
    });
    await pubsub.publish(topic, {
      type: 'run-completed',
      runId: 'conflicting-history-run',
      data: {
        type: 'run-completed',
        runId: 'conflicting-history-run',
        streamId: 'conflicting-history-stream',
        persisted: true,
        versionPins: {
          root: { agentId: 'stored-agent', versionId: 'v2', selectedLabel: 'production' },
        },
      },
    });

    await expect(
      remote.hydrateThreadRunVersionPins(
        { agentId: 'stored-agent', runId: 'conflicting-history-run', threadId: 'thread', resourceId: 'resource' },
        pubsub,
      ),
    ).rejects.toMatchObject({ id: 'PINNED_VERSION_INVALID' });
  });

  it('fails closed for missing source history but recognizes a registered unversioned source', async () => {
    const origin = new AgentThreadStreamRuntime();
    const remote = new AgentThreadStreamRuntime();
    const pubsub = new CachingPubSub(new EventEmitterPubSub(), new InMemoryServerCache());

    await expect(
      remote.hydrateThreadRunVersionPins(
        { agentId: 'code-agent', runId: 'missing', threadId: 'thread', resourceId: 'resource' },
        pubsub,
      ),
    ).rejects.toMatchObject({ id: 'PINNED_VERSION_REQUIRED' });

    let finish!: () => void;
    const finished = new Promise<void>(resolve => {
      finish = resolve;
    });
    const agent = new Agent({
      id: 'code-agent',
      name: 'code-agent',
      instructions: 'test',
      pubsub,
      model: new MockLanguageModelV2({
        doGenerate: async () => ({
          content: [{ type: 'text' as const, text: 'ok' }],
          finishReason: 'stop' as const,
          usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
          warnings: [],
        }),
      }),
    });
    const output = { ...completedOutput('code-run'), status: 'running', _waitUntilFinished: () => finished } as any;
    await origin.registerRun(agent, output, { memory: { thread: 'code-thread', resource: 'resource' } } as any, pubsub);
    output.status = 'success';
    finish();
    const topic = `agent.thread-stream.${encodeURIComponent('resource\u0000code-thread')}`;
    await vi.waitFor(async () => {
      expect((await pubsub.getHistory(topic)).some(event => event.data?.type === 'run-completed')).toBe(true);
    });

    const hydrated = await remote.hydrateThreadRunVersionPins(
      { agentId: 'code-agent', runId: 'code-run', threadId: 'code-thread', resourceId: 'resource' },
      pubsub,
    );
    expect(hydrated).toEqual({ runId: 'code-run', versionPins: undefined });

    // A production version may appear after this base-root run completes. Core
    // must preserve the retained rootless identity and never synthesize self.
    const stream = vi.spyOn(agent, 'stream').mockResolvedValue(completedOutput('code-continuation') as any);
    await agent.sendToolApproval({
      approved: true,
      messages: 'approved',
      sourceRunId: 'code-run',
      threadId: 'code-thread',
      resourceId: 'resource',
    });
    await vi.waitFor(() => expect(stream).toHaveBeenCalledOnce());
    expect(stream.mock.calls[0]?.[1]?.versions?.self).toBeUndefined();
    expect(getAgentVersionPins(stream.mock.calls[0]?.[1]?.requestContext)).toBeUndefined();
  });

  it('preserves an explicit new runId on direct sendToolApproval message continuations', async () => {
    const pubsub = new CachingPubSub(new EventEmitterPubSub(), new InMemoryServerCache());
    const agent = new Agent({
      id: 'stored-agent',
      name: 'stored-agent',
      instructions: 'test',
      pubsub,
      model: new MockLanguageModelV2({
        doGenerate: async () => ({
          content: [{ type: 'text' as const, text: 'ok' }],
          finishReason: 'stop' as const,
          usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
          warnings: [],
        }),
      }),
    });
    const requestContext = new RequestContext();
    setAgentVersionPins(requestContext, {
      root: { agentId: agent.id, versionId: 'v1', selectedLabel: 'production' },
      defaultStatus: 'published',
    });
    let finishActive!: () => void;
    const activeFinished = new Promise<void>(resolve => {
      finishActive = resolve;
    });
    const sourceOutput = {
      ...completedOutput('source-run'),
      status: 'running',
      _waitUntilFinished: () => activeFinished,
    } as any;
    await agentThreadStreamRuntime.registerRun(
      agent,
      sourceOutput,
      { requestContext, memory: { thread: 'thread', resource: 'resource' } } as any,
      pubsub,
    );
    const stream = vi.spyOn(agent, 'stream').mockResolvedValue(completedOutput('new-run') as any);

    sourceOutput.status = 'success';
    finishActive();
    const topic = `agent.thread-stream.${encodeURIComponent('resource\u0000thread')}`;
    await vi.waitFor(async () => {
      expect((await pubsub.getHistory(topic)).some(event => event.data?.type === 'run-completed')).toBe(true);
    });

    const result = await agent.sendToolApproval({
      approved: true,
      messages: 'approved',
      runId: 'new-run',
      threadId: 'thread',
      resourceId: 'resource',
    });
    expect(result.runId).toBe('new-run');
    await vi.waitFor(() => expect(stream).toHaveBeenCalledOnce());
    expect(stream.mock.calls[0]?.[1]).toMatchObject({
      runId: 'new-run',
      versions: { defaultStatus: 'published', self: { versionId: 'v1' } },
    });
  });

  it('keeps exact pins on a queued follow-up after the original label moves', async () => {
    const runtime = new AgentThreadStreamRuntime();
    const pubsub = new EventEmitterPubSub();
    const requestContext = new RequestContext();
    setAgentVersionPins(requestContext, {
      root: { agentId: 'stored-agent', versionId: 'v1', selectedLabel: 'production' },
      defaultStatus: 'published',
    });
    let finishActive!: () => void;
    const activeFinished = new Promise<void>(resolve => {
      finishActive = resolve;
    });
    const stream = vi.fn(async (_messages: unknown, options: any) => completedOutput(options.runId));
    const agent = { id: 'stored-agent', stream } as unknown as Agent<any, any, any, any>;
    await runtime.registerRun(
      agent,
      { ...completedOutput('active-run'), status: 'running', _waitUntilFinished: () => activeFinished },
      { requestContext, memory: { thread: 'thread', resource: 'resource' } } as any,
      pubsub,
    );

    runtime.queueMessage(agent, 'next', { threadId: 'thread', resourceId: 'resource' }, pubsub);
    finishActive();

    await vi.waitFor(() => expect(stream).toHaveBeenCalledOnce());
    expect(stream.mock.calls[0]?.[1]?.versions).toEqual({
      defaultStatus: 'published',
      self: { versionId: 'v1' },
    });
  });
});
