import { describe, expect, it, vi } from 'vitest';
import type { Mastra } from '../../mastra';
import type { ScheduleTarget } from '../../storage/domains/schedules/base';
import { executeHeartbeat } from './worker';

type HeartbeatTarget = Extract<ScheduleTarget, { type: 'heartbeat' }>;

// Build a `sendSignal` return matching the `accepted` API: a sync object
// carrying `signal` plus an `accepted` promise that resolves to the routing
// decision. `wake`/`deliver` carry a `runId`; `persist`/`discard` never do.
function signalResult(
  decision:
    | { action: 'wake'; runId: string }
    | { action: 'deliver'; runId: string }
    | { action: 'persist' }
    | { action: 'discard' }
    | { action: 'blocked'; reason: 'thread-blocked'; runId: string },
  extra: { persisted?: Promise<void> } = {},
): any {
  const accepted = decision.action === 'wake' ? { ...decision, output: {} } : decision;
  return { signal: {}, accepted: Promise.resolve(accepted), ...extra };
}

function makeStorage(deleteSchedule = vi.fn().mockResolvedValue(undefined)) {
  return {
    getStore: vi.fn(async (name: string) => (name === 'schedules' ? { deleteSchedule } : null)),
    deleteSchedule,
  };
}

function makeMastra(
  opts: {
    agent?: any;
    storage?: ReturnType<typeof makeStorage>;
    agentThrows?: boolean;
  } = {},
) {
  const storage = opts.storage ?? makeStorage();
  return {
    storage,
    getStorage: () => storage,
    getAgentById: vi.fn(() => {
      if (opts.agentThrows) throw new Error('not found');
      if (!opts.agent) throw new Error('not found');
      return opts.agent;
    }),
    getLogger: () => ({ debug: vi.fn(), error: vi.fn(), warn: vi.fn(), info: vi.fn() }),
  } as unknown as Mastra;
}

function makeTarget(overrides: Partial<HeartbeatTarget> = {}): HeartbeatTarget {
  return {
    type: 'heartbeat',
    agentId: 'a1',
    prompt: 'check in',
    ...overrides,
  } as HeartbeatTarget;
}

describe('HeartbeatWorker — executeHeartbeat', () => {
  it('returns agent-missing and self-cleans when the agent is unregistered', async () => {
    const storage = makeStorage();
    const mastra = makeMastra({ agentThrows: true, storage });

    const result = await executeHeartbeat(mastra, 'hb_a1', makeTarget());

    expect(result.status).toBe('agent-missing');
    expect(storage.deleteSchedule).toHaveBeenCalledWith('hb_a1');
  });

  it('returns thread-missing and self-cleans when the thread is not found', async () => {
    const storage = makeStorage();
    const sendSignal = vi.fn();
    const agent = {
      sendSignal,
      generate: vi.fn(),
      getMemory: vi.fn(async () => ({
        getThreadById: vi.fn(async () => null),
      })),
    };
    const mastra = makeMastra({ agent, storage });

    const result = await executeHeartbeat(mastra, 'hb_a1', makeTarget({ threadId: 't1', resourceId: 'r1' }));

    expect(result.status).toBe('thread-missing');
    expect(storage.deleteSchedule).toHaveBeenCalledWith('hb_a1');
    expect(sendSignal).not.toHaveBeenCalled();
  });

  it('rejects threaded input that omits resourceId', async () => {
    const agent = { sendSignal: vi.fn(), generate: vi.fn(), getMemory: vi.fn() };
    const mastra = makeMastra({ agent });

    const result = await executeHeartbeat(mastra, 'hb_a1', makeTarget({ threadId: 't1' }));

    expect(result.status).toBe('invalid-input');
    expect(agent.sendSignal).not.toHaveBeenCalled();
  });

  it('calls sendSignal with defaults when threaded', async () => {
    const sendSignal: any = vi.fn(() => signalResult({ action: 'wake', runId: 'run-1' }));
    const agent = {
      sendSignal,
      generate: vi.fn(),
      getMemory: vi.fn(async () => ({
        getThreadById: vi.fn(async () => ({ id: 't1', updatedAt: new Date(Date.now() - 60_000) })),
      })),
    };
    const mastra = makeMastra({ agent });

    const result = await executeHeartbeat(
      mastra,
      'hb_a1',
      makeTarget({ threadId: 't1', resourceId: 'r1', prompt: 'ping' }),
    );

    expect(result.status).toBe('signal-accepted');
    expect(sendSignal).toHaveBeenCalledTimes(1);
    const [signal, target] = sendSignal.mock.calls[0]!;
    expect(signal).toMatchObject({
      type: 'notification',
      tagName: 'heartbeat',
      contents: 'ping',
      providerOptions: { mastra: { heartbeat: { scheduleId: 'hb_a1', threadId: 't1' } } },
    });
    expect(target).toMatchObject({
      threadId: 't1',
      resourceId: 'r1',
    });
    expect(target.ifActive).toBeUndefined();
    expect(target.ifIdle).toBeUndefined();
  });

  it('forwards signalType, ifActive, ifIdle to sendSignal', async () => {
    const sendSignal: any = vi.fn(() => signalResult({ action: 'deliver', runId: 'run-2' }));
    const agent = {
      sendSignal,
      generate: vi.fn(),
      getMemory: vi.fn(async () => ({
        getThreadById: vi.fn(async () => ({ id: 't1', updatedAt: new Date(0) })),
      })),
    };
    const mastra = makeMastra({ agent });

    await executeHeartbeat(
      mastra,
      'hb_a1',
      makeTarget({
        threadId: 't1',
        resourceId: 'r1',
        signalType: 'system-reminder',
        ifActive: { behavior: 'deliver', attributes: { source: 'cron' } },
        ifIdle: { behavior: 'persist', attributes: { kind: 'wake' } },
      }),
    );

    const [signal, target] = sendSignal.mock.calls[0]!;
    expect(signal.type).toBe('system-reminder');
    expect(signal.tagName).toBe('heartbeat');
    expect(signal.providerOptions).toEqual({
      mastra: { heartbeat: { scheduleId: 'hb_a1', threadId: 't1' } },
    });
    expect(target.ifActive).toEqual({ behavior: 'deliver', attributes: { source: 'cron' } });
    expect(target.ifIdle).toEqual({ behavior: 'persist', attributes: { kind: 'wake' } });
  });

  it('rehydrates ifIdle.streamOptions.requestContext into a RequestContext', async () => {
    const sendSignal: any = vi.fn(() => signalResult({ action: 'wake', runId: 'run-3' }));
    const agent = {
      sendSignal,
      generate: vi.fn(),
      getMemory: vi.fn(async () => ({
        getThreadById: vi.fn(async () => ({ id: 't1', updatedAt: new Date(0) })),
      })),
    };
    const mastra = makeMastra({ agent });

    await executeHeartbeat(
      mastra,
      'hb_a1',
      makeTarget({
        threadId: 't1',
        resourceId: 'r1',
        ifIdle: { behavior: 'wake', streamOptions: { requestContext: { channel: 'slack', foo: 1 } } },
      }),
    );

    const [, target] = sendSignal.mock.calls[0]!;
    expect(target.ifIdle.behavior).toBe('wake');
    const rc = target.ifIdle.streamOptions.requestContext;
    expect(rc.get('channel')).toBe('slack');
    expect(rc.get('foo')).toBe(1);
  });

  it('forwards stored providerOptions on the signal payload merged with heartbeat run metadata', async () => {
    const sendSignal: any = vi.fn(() => signalResult({ action: 'deliver', runId: 'run-4' }));
    const agent = {
      sendSignal,
      generate: vi.fn(),
      getMemory: vi.fn(async () => ({
        getThreadById: vi.fn(async () => ({ id: 't1', updatedAt: new Date(0) })),
      })),
    };
    const mastra = makeMastra({ agent });

    await executeHeartbeat(
      mastra,
      'hb_a1',
      makeTarget({
        threadId: 't1',
        resourceId: 'r1',
        providerOptions: { openai: { store: true } },
      }),
    );

    const [signal] = sendSignal.mock.calls[0]!;
    expect(signal.providerOptions).toEqual({
      openai: { store: true },
      mastra: { heartbeat: { scheduleId: 'hb_a1', threadId: 't1' } },
    });
  });

  it('reports skipped-thread-blocked when the signal targets a suspended thread', async () => {
    const sendSignal: any = vi.fn(() =>
      signalResult({ action: 'blocked', reason: 'thread-blocked', runId: 'run-blocked' }),
    );
    const agent = {
      sendSignal,
      generate: vi.fn(),
      getMemory: vi.fn(async () => ({
        getThreadById: vi.fn(async () => ({ id: 't1', updatedAt: new Date(0) })),
      })),
    };
    const mastra = makeMastra({ agent });

    const result = await executeHeartbeat(mastra, 'hb_a1', makeTarget({ threadId: 't1', resourceId: 'r1' }));

    expect(result.status).toBe('skipped-thread-blocked');
    expect(result.outcome).toBe('skipped');
    expect(result.runId).toBe('run-blocked');
  });

  it('calls agent.generate in threadless mode', async () => {
    const generate = vi.fn(async () => ({}));
    const sendSignal = vi.fn();
    const agent = { sendSignal, generate, getMemory: vi.fn() };
    const mastra = makeMastra({ agent });

    const result = await executeHeartbeat(mastra, 'hb_a1', makeTarget({ prompt: 'tick' }));

    expect(result.status).toBe('fired');
    const call = generate.mock.calls[0] as any[];
    expect(call[0]).toBe('tick');
    expect(call[1].providerOptions).toEqual({
      mastra: { heartbeat: { scheduleId: 'hb_a1' } },
    });
    expect(sendSignal).not.toHaveBeenCalled();
  });

  it('does not self-clean on regular outcomes', async () => {
    const storage = makeStorage();
    const agent = { sendSignal: vi.fn(), generate: vi.fn(async () => ({})), getMemory: vi.fn() };
    const mastra = makeMastra({ agent, storage });

    await executeHeartbeat(mastra, 'hb_a1', makeTarget());
    expect(storage.deleteSchedule).not.toHaveBeenCalled();
  });
});
