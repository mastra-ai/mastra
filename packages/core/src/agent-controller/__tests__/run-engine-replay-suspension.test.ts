import { describe, expect, it, vi } from 'vitest';

import { AgentThreadStreamRuntime, markReplayedStreamPart } from '../../agent/thread-stream-runtime';
import { PubSub } from '../../events/pubsub';
import type { EventCallback } from '../../events/types';
import { RequestContext } from '../../request-context';
import { Workspace } from '../../workspace';
import { LocalFilesystem } from '../../workspace/filesystem/local-filesystem';
import type { SessionMachinery } from '../session';
import { Session } from '../session';
import { SessionRunEngine } from '../session-run-engine';
import type { AgentControllerEvent } from '../types';

class RetainedPubSub extends PubSub {
  #history = new Map<string, any[]>();
  #subscribers = new Map<string, Set<EventCallback>>();
  #index = 0;

  async publish(topic: string, event: any): Promise<void> {
    const envelope = { ...event, id: `event-${this.#index++}`, createdAt: new Date() };
    const history = this.#history.get(topic) ?? [];
    history.push(envelope);
    this.#history.set(topic, history);
    for (const subscriber of this.#subscribers.get(topic) ?? []) subscriber(envelope);
  }

  async subscribe(topic: string, callback: EventCallback): Promise<void> {
    const subscribers = this.#subscribers.get(topic) ?? new Set<EventCallback>();
    subscribers.add(callback);
    this.#subscribers.set(topic, subscribers);
    for (const event of this.#history.get(topic) ?? []) callback(event);
  }

  async unsubscribe(topic: string, callback: EventCallback): Promise<void> {
    this.#subscribers.get(topic)?.delete(callback);
  }

  async flush(): Promise<void> {}
}

function createHarness() {
  const events: AgentControllerEvent[] = [];
  const agent = {
    id: 'agent-stub',
    listSuspendedRuns: vi.fn(async (): Promise<any> => ({ runs: [] })),
    sendToolApproval: vi.fn(async () => {}),
  };
  const session = new Session({
    resourceId: 'resource-1',
    id: 'session-1',
    ownerId: 'owner-1',
    workspace: new Workspace({
      id: 'workspace-1',
      filesystem: new LocalFilesystem({ basePath: '/tmp' }),
    }),
  });
  session.thread.set({ threadId: 'thread-1' });
  session.subscribe(event => {
    events.push(event);
  });

  const machinery: SessionMachinery = {
    getAgent: () => agent as any,
    getRunScope: () => undefined,
    subscribeToThread: async () => {
      throw new Error('subscribeToThread is not used by these tests');
    },
    buildStreamOptions: async () => ({}),
    buildSharedRunOptions: () => ({}),
    buildToolsets: async () => ({}),
    buildRequestContext: async requestContext => requestContext ?? new RequestContext(),
    persistTokenUsage: vi.fn(async () => {}),
    generateId: () => 'msg-1',
    resolveTransitionModeId: () => undefined,
    saveSystemReminder: vi.fn(async () => null),
  };

  return { agent, engine: new SessionRunEngine(session, machinery), events, session };
}

function replaySubscription(chunks: any[]) {
  return {
    stream: (async function* () {
      yield* chunks.map(markReplayedStreamPart);
    })(),
    activeRunId: () => null,
    abort: () => false,
    unsubscribe: vi.fn(),
  };
}

describe('SessionRunEngine — replayed interactive suspensions', () => {
  it('ignores obsolete replayed approval and suspension events', async () => {
    const { agent, engine, events, session } = createHarness();
    session.state.set({ yolo: true });
    const subscription = replaySubscription([
      { type: 'start', runId: 'completed-run' },
      {
        type: 'tool-call-approval',
        runId: 'completed-run',
        payload: { toolCallId: 'approval-call', toolName: 'write_file', args: {} },
      },
      {
        type: 'tool-call-suspended',
        runId: 'completed-run',
        payload: { toolCallId: 'suspended-call', toolName: 'ask_user', args: {}, suspendPayload: {} },
      },
    ]);
    session.stream.attach({ subscription, key: 'thread-1' });

    await engine.processSubscribedThreadStream(subscription as any);

    expect(agent.sendToolApproval).not.toHaveBeenCalled();
    expect(session.suspensions.hasPending()).toBe(false);
    expect(events).not.toContainEqual(expect.objectContaining({ type: 'tool_suspended' }));
    expect(events).not.toContainEqual(expect.objectContaining({ type: 'error' }));
  });

  it('replays a suspended generation before a completed continuation without reviving its side effects', async () => {
    const { agent, engine, events, session } = createHarness();
    session.state.set({ yolo: true });
    const pubsub = new RetainedPubSub();
    const runtime = new AgentThreadStreamRuntime();
    const runId = 'continued-run';
    const topic = `agent.thread-stream.${encodeURIComponent('resource-1\u0000thread-1')}`;

    const publish = (type: string, data: Record<string, unknown>) => pubsub.publish(topic, { type, data });
    await publish('run-registered', { type: 'run-registered', runId, streamId: 'suspended-stream', streamSeq: 1 });
    await publish('stream-part', { type: 'stream-part', runId, streamId: 'suspended-stream', part: { type: 'start' } });
    await publish('stream-part', {
      type: 'stream-part',
      runId,
      streamId: 'suspended-stream',
      part: {
        type: 'tool-call-approval',
        payload: { toolCallId: 'approval-call', toolName: 'write_file', args: {} },
      },
    });
    await publish('stream-part', {
      type: 'stream-part',
      runId,
      streamId: 'suspended-stream',
      part: {
        type: 'tool-call-suspended',
        payload: { toolCallId: 'suspended-call', toolName: 'ask_user', args: {}, suspendPayload: {} },
      },
    });
    await publish('run-suspended', { type: 'run-suspended', runId, streamId: 'suspended-stream' });
    await publish('run-registered', { type: 'run-registered', runId, streamId: 'completed-stream', streamSeq: 2 });
    await publish('stream-part', { type: 'stream-part', runId, streamId: 'completed-stream', part: { type: 'start' } });
    await publish('stream-part', {
      type: 'stream-part',
      runId,
      streamId: 'completed-stream',
      part: { type: 'finish', payload: { stepResult: { reason: 'stop' } } },
    });
    await publish('run-completed', { type: 'run-completed', runId, streamId: 'completed-stream', persisted: true });

    const subscription = await runtime.subscribeToThread(
      agent as any,
      { threadId: 'thread-1', resourceId: 'resource-1' },
      pubsub,
    );
    session.stream.attach({ subscription, key: 'thread-1' });
    const processing = engine.processSubscribedThreadStream(subscription as any);
    await vi.waitFor(() => expect(agent.listSuspendedRuns).toHaveBeenCalledTimes(2));
    subscription.unsubscribe();
    await processing;

    expect(agent.sendToolApproval).not.toHaveBeenCalled();
    expect(session.suspensions.hasPending()).toBe(false);
    expect(events).not.toContainEqual(expect.objectContaining({ type: 'tool_suspended' }));
    expect(events).not.toContainEqual(expect.objectContaining({ type: 'error' }));
  });

  it('restores replayed suspension events with a durable snapshot', async () => {
    const { agent, engine, events, session } = createHarness();
    agent.listSuspendedRuns.mockResolvedValueOnce({
      runs: [{ runId: 'durable-run', toolCalls: [{ toolCallId: 'durable-call' }] }],
    });
    const subscription = replaySubscription([
      { type: 'start', runId: 'durable-run' },
      {
        type: 'tool-call-suspended',
        runId: 'durable-run',
        payload: { toolCallId: 'durable-call', toolName: 'ask_user', args: {}, suspendPayload: {} },
      },
    ]);
    session.stream.attach({ subscription, key: 'thread-1' });

    await engine.processSubscribedThreadStream(subscription as any);

    expect(session.suspensions.hasPending()).toBe(true);
    expect(events).toContainEqual(expect.objectContaining({ type: 'tool_suspended', toolCallId: 'durable-call' }));
  });
});
