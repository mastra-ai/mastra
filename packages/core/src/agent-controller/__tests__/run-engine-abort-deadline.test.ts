import { afterEach, describe, expect, it, vi } from 'vitest';
import { RequestContext } from '../../request-context';
import { Workspace } from '../../workspace';
import { LocalFilesystem } from '../../workspace/filesystem/local-filesystem';
import type { SessionMachinery } from '../session';
import { Session } from '../session';
import { SessionRunEngine } from '../session-run-engine';
import type { AgentControllerEvent } from '../types';

type StreamChunk = Parameters<SessionRunEngine['processStreamChunk']>[1];

function createHarness() {
  const events: AgentControllerEvent[] = [];
  let idCounter = 0;

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
    getAgent: () => {
      throw new Error('getAgent is not used by these tests');
    },
    subscribeToThread: async () => {
      throw new Error('subscribeToThread is not used by these tests');
    },
    buildStreamOptions: async () => ({}),
    buildSharedRunOptions: () => ({}),
    buildToolsets: async () => ({}),
    buildRequestContext: async requestContext => requestContext ?? new RequestContext(),
    persistTokenUsage: vi.fn(async () => {}),
    generateId: () => `msg-${++idCounter}`,
    resolveTransitionModeId: () => undefined,
    saveSystemReminder: vi.fn(async () => null),
  };

  const engine = new SessionRunEngine(session, machinery);
  return { engine, events, session };
}

function chunk(value: StreamChunk): StreamChunk {
  return value;
}

describe('SessionRunEngine — abort deadline', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('Given a stream hung mid-run, When the run is aborted, Then it still finalizes as aborted after the grace period', async () => {
    vi.useFakeTimers();
    const { engine, events, session } = createHarness();
    session.run.ensureAbortController();

    const processed = engine.processStream({
      fullStream: (async function* () {
        yield chunk({ type: 'text-start', payload: { id: 't1' } });
        yield chunk({ type: 'text-delta', payload: { id: 't1', text: 'partial' } });
        await new Promise(() => {});
      })(),
    });
    await vi.advanceTimersByTimeAsync(0);

    session.abortRun();
    await vi.advanceTimersByTimeAsync(5_000);

    const result = await processed;
    expect(events).toContainEqual({ type: 'agent_end', reason: 'aborted' });
    expect(session.run.isRunning()).toBe(false);
    expect(result?.message.content.parts).toEqual([{ type: 'text', text: 'partial' }]);
  });

  it('Given a stream that reacts to the abort signal in time, Then the deadline never fires', async () => {
    const { engine, events, session } = createHarness();
    const abortController = session.run.ensureAbortController();

    const result = await engine.processStream({
      fullStream: (async function* () {
        yield chunk({ type: 'text-start', payload: { id: 't1' } });
        abortController.abort();
        session.run.requestAbort();
        yield chunk({ type: 'abort', payload: {} });
      })(),
    });

    expect(events).toContainEqual({ type: 'agent_end', reason: 'aborted' });
    expect(result?.message).toBeDefined();
  });
});
