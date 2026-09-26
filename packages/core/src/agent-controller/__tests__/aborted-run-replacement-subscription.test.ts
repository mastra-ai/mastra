/**
 * Regression test for https://github.com/mastra-ai/mastra/issues/24174
 *
 * A run that is aborted but never terminalizes stays in the runtime's
 * `activeThreadRunIds`. When the session's consumer dies on that abort and a
 * later signal opens a replacement subscription, the replacement used to seed
 * itself with the aborted run and replay its buffered chunks, so the session
 * emitted a second `agent_start` and a second terminal lifecycle for a run the
 * user had already stopped.
 */
import { describe, expect, it } from 'vitest';
import type { Agent } from '../../agent/agent';
import { AgentThreadStreamRuntime } from '../../agent/thread-stream-runtime';
import { EventEmitterPubSub } from '../../events/event-emitter';
import { RequestContext } from '../../request-context';
import type { MastraModelOutput } from '../../stream/base/output';
import { Workspace } from '../../workspace';
import { LocalFilesystem } from '../../workspace/filesystem/local-filesystem';
import type { SessionMachinery } from '../session';
import { Session } from '../session';
import { SessionRunEngine } from '../session-run-engine';
import type { AgentControllerEvent } from '../types';

const agent = { id: 'aborted-replay-agent' } as unknown as Agent<any, any, any, any>;
const threadId = 'aborted-replay-thread';
const resourceId = 'aborted-replay-user';
const target = { threadId, resourceId };
const memory = { thread: threadId, resource: resourceId };

function nextTicks(count = 5) {
  return Array.from({ length: count }).reduce<Promise<void>>(
    acc => acc.then(() => new Promise(resolve => setTimeout(resolve, 0))),
    Promise.resolve(),
  );
}

function createHarness() {
  const events: AgentControllerEvent[] = [];
  let idCounter = 0;

  const session = new Session({
    resourceId,
    id: 'session-1',
    ownerId: 'owner-1',
    workspace: new Workspace({ id: 'workspace-1', filesystem: new LocalFilesystem({ basePath: '/tmp' }) }),
  });
  session.thread.set({ threadId });
  session.subscribe(event => {
    events.push(event);
  });

  const machinery: SessionMachinery = {
    getAgent: () => agent as unknown as ReturnType<SessionMachinery['getAgent']>,
    subscribeToThread: async () => {
      throw new Error('subscribeToThread is not used by this test');
    },
    buildStreamOptions: async () => ({}),
    buildSharedRunOptions: () => ({}),
    buildToolsets: async () => ({}),
    buildRequestContext: async requestContext => requestContext ?? new RequestContext(),
    persistTokenUsage: async () => {},
    generateId: () => `msg-${++idCounter}`,
    resolveTransitionModeId: () => undefined,
    saveSystemReminder: async () => null,
  };

  return { engine: new SessionRunEngine(session, machinery), events, session };
}

/** A run whose stream stays open until the test closes it (a hung run never terminalizes). */
function createFakeRun(runId: string) {
  let streamController!: ReadableStreamDefaultController<unknown>;
  let settle!: () => void;
  let status: 'running' | 'success' = 'running';
  const finished = new Promise<void>(resolve => {
    settle = resolve;
  });

  const output = {
    runId,
    get status() {
      return status;
    },
    fullStream: new ReadableStream<unknown>({
      start(controller) {
        streamController = controller;
      },
    }),
    _waitUntilFinished: () => finished,
  } as unknown as MastraModelOutput<unknown>;

  return {
    output,
    push: (part: unknown) => streamController.enqueue(part),
    finish() {
      status = 'success';
      streamController.close();
      settle();
    },
  };
}

async function startRun(runtime: AgentThreadStreamRuntime, pubsub: EventEmitterPubSub, runId: string) {
  const run = createFakeRun(runId);
  runtime.prepareRunOptions({ runId, memory }, pubsub);
  await runtime.registerRun(agent, run.output, { memory }, pubsub);
  return run;
}

describe('SessionRunEngine — replacement subscription after an aborted run', () => {
  it('Given an aborted run that never terminalizes, When a replacement subscription opens, Then no second lifecycle is emitted and the next run still runs', async () => {
    const { engine, events, session } = createHarness();
    const runtime = new AgentThreadStreamRuntime();
    const pubsub = new EventEmitterPubSub();
    const hung = await startRun(runtime, pubsub, 'hung-run');

    const first = await runtime.subscribeToThread(agent, target, pubsub);
    session.stream.attach({ subscription: first, key: 'agent:thread-1' });
    const firstProcessed = engine.processSubscribedThreadStream(first);
    hung.push({ type: 'start', payload: {} });
    hung.push({ type: 'text-delta', payload: { id: 't1', text: 'partial' } });
    await nextTicks();
    expect(events.filter(event => event.type === 'agent_start')).toHaveLength(1);

    // Stop the run and lose the consumer in the same tick — the hung run never
    // terminalizes, so it is still the thread's active run afterwards.
    session.abortRun();
    first.unsubscribe();
    await firstProcessed;
    await nextTicks();
    expect(events.filter(event => event.type === 'agent_end')).toEqual([{ type: 'agent_end', reason: 'aborted' }]);
    expect(runtime.getActiveThreadRunId(target, pubsub)).toBe('hung-run');

    // The next signal opens a replacement subscription on the same thread.
    const replacement = await runtime.subscribeToThread(agent, target, pubsub);
    session.stream.attach({ subscription: replacement, key: 'agent:thread-1' });
    void engine.processSubscribedThreadStream(replacement);
    await nextTicks();

    expect(events.filter(event => event.type === 'agent_start')).toHaveLength(1);
    expect(events.filter(event => event.type === 'agent_end')).toEqual([{ type: 'agent_end', reason: 'aborted' }]);

    // ...and the follow-up run is still delivered on that subscription.
    const followUp = await startRun(runtime, pubsub, 'follow-up-run');
    followUp.push({ type: 'start', payload: {} });
    followUp.push({ type: 'text-delta', payload: { id: 't2', text: 'follow-up' } });
    followUp.push({ type: 'finish', payload: { stepResult: { reason: 'stop' } } });
    await nextTicks();

    expect(events.filter(event => event.type === 'agent_start')).toHaveLength(2);
    expect(events.filter(event => event.type === 'agent_end')).toEqual([
      { type: 'agent_end', reason: 'aborted' },
      { type: 'agent_end', reason: 'complete' },
    ]);

    followUp.finish();
    replacement.unsubscribe();
    await pubsub.close();
  });
});
