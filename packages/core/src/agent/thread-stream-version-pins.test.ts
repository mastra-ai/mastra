import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it, vi } from 'vitest';
import { InMemoryServerCache } from '../cache/inmemory';
import { CachingPubSub } from '../events/caching-pubsub';
import { EventEmitterPubSub } from '../events/event-emitter';
import { MASTRA_VERSIONS_KEY, RequestContext } from '../request-context';
import { Agent } from './agent';
import { AgentThreadStreamRuntime, agentThreadStreamRuntime } from './thread-stream-runtime';
import { getAgentVersionPins, setAgentVersionPins } from './version-pins';

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

describe('thread stream version pins', () => {
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
