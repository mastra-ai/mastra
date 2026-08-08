import { describe, expect, it, vi } from 'vitest';
import type { Mastra } from '../mastra';
import type { ScheduleTarget } from '../storage/domains/schedules/base';
import { executeAgentSchedule } from './worker';

type AgentTarget = Extract<ScheduleTarget, { type: 'agent' }>;

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
    hooks?: any;
    scheduleGet?: ReturnType<typeof vi.fn>;
    editorGetById?: ReturnType<typeof vi.fn>;
    fsHandler?: any;
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
    ...(opts.hooks ? { __getScheduleHooks: () => opts.hooks } : {}),
    ...(opts.scheduleGet ? { schedules: { get: opts.scheduleGet } } : {}),
    ...(opts.editorGetById ? { getEditor: () => ({ agent: { getById: opts.editorGetById } }) } : {}),
    ...(opts.fsHandler ? { __getFsAgentScheduleHandler: () => opts.fsHandler } : {}),
  } as unknown as Mastra;
}

function makeTarget(overrides: Partial<AgentTarget> = {}): AgentTarget {
  return {
    type: 'agent',
    agentId: 'a1',
    prompt: 'check in',
    ...overrides,
  } as AgentTarget;
}

describe('AgentScheduleWorker — executeAgentSchedule', () => {
  it('returns agent-missing and self-cleans when the agent is unregistered', async () => {
    const storage = makeStorage();
    const mastra = makeMastra({ agentThrows: true, storage });

    const result = await executeAgentSchedule(mastra, 'agent_a1', makeTarget());

    expect(result.status).toBe('agent-missing');
    expect(storage.deleteSchedule).toHaveBeenCalledWith('agent_a1');
  });

  it('falls back to the editor for stored agents not yet hydrated into the registry', async () => {
    const storage = makeStorage();
    const storedAgent = {
      sendSignal: vi.fn(),
      generate: vi.fn(async () => ({ text: 'ok' })),
      getMemory: vi.fn(),
    };
    const editorGetById = vi.fn(async () => storedAgent);
    const mastra = makeMastra({ agentThrows: true, storage, editorGetById });

    const result = await executeAgentSchedule(mastra, 'agent_a1', makeTarget());

    expect(editorGetById).toHaveBeenCalledWith('a1');
    expect(storedAgent.generate).toHaveBeenCalled();
    expect(result).toMatchObject({ status: 'fired', outcome: 'succeeded' });
    expect(storage.deleteSchedule).not.toHaveBeenCalled();
  });

  it('returns agent-missing and self-cleans when both registry and editor miss', async () => {
    const storage = makeStorage();
    const editorGetById = vi.fn(async () => null);
    const mastra = makeMastra({ agentThrows: true, storage, editorGetById });

    const result = await executeAgentSchedule(mastra, 'agent_a1', makeTarget());

    expect(editorGetById).toHaveBeenCalledWith('a1');
    expect(result.status).toBe('agent-missing');
    expect(storage.deleteSchedule).toHaveBeenCalledWith('agent_a1');
  });

  it('preserves the schedule when the editor lookup throws', async () => {
    const storage = makeStorage();
    const editorGetById = vi.fn(async () => {
      throw new Error('storage down');
    });
    const mastra = makeMastra({ agentThrows: true, storage, editorGetById });

    const result = await executeAgentSchedule(mastra, 'agent_a1', makeTarget());

    expect(result).toMatchObject({
      status: 'agent-missing',
      outcome: 'failed',
      reason: 'failed to resolve agent "a1"',
    });
    expect(storage.deleteSchedule).not.toHaveBeenCalled();
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

    const result = await executeAgentSchedule(mastra, 'agent_a1', makeTarget({ threadId: 't1', resourceId: 'r1' }));

    expect(result.status).toBe('thread-missing');
    expect(storage.deleteSchedule).toHaveBeenCalledWith('agent_a1');
    expect(sendSignal).not.toHaveBeenCalled();
  });

  it('rejects threaded input that omits resourceId', async () => {
    const agent = { sendSignal: vi.fn(), generate: vi.fn(), getMemory: vi.fn() };
    const mastra = makeMastra({ agent });

    const result = await executeAgentSchedule(mastra, 'agent_a1', makeTarget({ threadId: 't1' }));

    expect(result.status).toBe('invalid-input');
    expect(agent.sendSignal).not.toHaveBeenCalled();
  });

  it('skips the schedule-row lookup when no hooks are configured', async () => {
    const scheduleGet = vi.fn(async () => null);
    const agent = {
      sendSignal: vi.fn(),
      generate: vi.fn(async () => ({ text: 'ok' })),
      getMemory: vi.fn(),
    };
    const mastra = makeMastra({ agent, scheduleGet });

    await executeAgentSchedule(mastra, 'agent_a1', makeTarget());

    expect(scheduleGet).not.toHaveBeenCalled();
  });

  it('loads the schedule row for hook context when hooks are configured', async () => {
    const scheduleGet = vi.fn(async () => null);
    const prepare = vi.fn(async () => undefined);
    const agent = {
      sendSignal: vi.fn(),
      generate: vi.fn(async () => ({ text: 'ok' })),
      getMemory: vi.fn(),
    };
    const mastra = makeMastra({ agent, scheduleGet, hooks: { prepare } });

    await executeAgentSchedule(mastra, 'agent_a1', makeTarget());

    expect(scheduleGet).toHaveBeenCalledWith('agent_a1');
    expect(prepare).toHaveBeenCalled();
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

    const result = await executeAgentSchedule(
      mastra,
      'agent_a1',
      makeTarget({ threadId: 't1', resourceId: 'r1', prompt: 'ping' }),
    );

    expect(result.status).toBe('signal-accepted');
    expect(sendSignal).toHaveBeenCalledTimes(1);
    const [signal, target] = sendSignal.mock.calls[0]!;
    expect(signal).toMatchObject({
      type: 'notification',
      tagName: 'schedule',
      contents: 'ping',
      providerOptions: { mastra: { schedule: { scheduleId: 'agent_a1', threadId: 't1' } } },
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

    await executeAgentSchedule(
      mastra,
      'agent_a1',
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
    expect(signal.tagName).toBe('schedule');
    expect(signal.providerOptions).toEqual({
      mastra: { schedule: { scheduleId: 'agent_a1', threadId: 't1' } },
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

    await executeAgentSchedule(
      mastra,
      'agent_a1',
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

  it('forwards stored providerOptions on the signal payload merged with schedule run metadata', async () => {
    const sendSignal: any = vi.fn(() => signalResult({ action: 'deliver', runId: 'run-4' }));
    const agent = {
      sendSignal,
      generate: vi.fn(),
      getMemory: vi.fn(async () => ({
        getThreadById: vi.fn(async () => ({ id: 't1', updatedAt: new Date(0) })),
      })),
    };
    const mastra = makeMastra({ agent });

    await executeAgentSchedule(
      mastra,
      'agent_a1',
      makeTarget({
        threadId: 't1',
        resourceId: 'r1',
        providerOptions: { openai: { store: true } },
      }),
    );

    const [signal] = sendSignal.mock.calls[0]!;
    expect(signal.providerOptions).toEqual({
      openai: { store: true },
      mastra: { schedule: { scheduleId: 'agent_a1', threadId: 't1' } },
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

    const result = await executeAgentSchedule(mastra, 'agent_a1', makeTarget({ threadId: 't1', resourceId: 'r1' }));

    expect(result.status).toBe('skipped-thread-blocked');
    expect(result.outcome).toBe('skipped');
    expect(result.runId).toBe('run-blocked');
  });

  it('calls agent.generate in threadless mode', async () => {
    const generate = vi.fn(async () => ({}));
    const sendSignal = vi.fn();
    const agent = { sendSignal, generate, getMemory: vi.fn() };
    const mastra = makeMastra({ agent });

    const result = await executeAgentSchedule(mastra, 'agent_a1', makeTarget({ prompt: 'tick' }));

    expect(result.status).toBe('fired');
    const call = generate.mock.calls[0] as any[];
    expect(call[0]).toBe('tick');
    expect(call[1].providerOptions).toEqual({
      mastra: { schedule: { scheduleId: 'agent_a1' } },
    });
    expect(sendSignal).not.toHaveBeenCalled();
  });

  it('does not self-clean on regular outcomes', async () => {
    const storage = makeStorage();
    const agent = { sendSignal: vi.fn(), generate: vi.fn(async () => ({})), getMemory: vi.fn() };
    const mastra = makeMastra({ agent, storage });

    await executeAgentSchedule(mastra, 'agent_a1', makeTarget());
    expect(storage.deleteSchedule).not.toHaveBeenCalled();
  });
});

describe('AgentScheduleWorker — handler-mode file-based schedules', () => {
  const rowId = 'fsa_support__billing%2Fsweep';

  it('fires with the prompt the handler computes', async () => {
    const generate = vi.fn(async () => ({}));
    const agent = { sendSignal: vi.fn(), generate, getMemory: vi.fn() };
    const fsHandler = vi.fn(async () => ({ prompt: 'computed at fire time' }));
    const mastra = makeMastra({ agent, fsHandler });

    const result = await executeAgentSchedule(mastra, rowId, makeTarget({ prompt: '' }));

    expect(result.status).toBe('fired');
    expect((generate.mock.calls[0] as any[])[0]).toBe('computed at fire time');
  });

  it('passes the decoded agent id and path-derived key to the handler', async () => {
    const agent = { sendSignal: vi.fn(), generate: vi.fn(async () => ({})), getMemory: vi.fn() };
    const fsHandler = vi.fn(async () => ({ prompt: 'go' }));
    const mastra = makeMastra({ agent, fsHandler });

    await executeAgentSchedule(mastra, rowId, makeTarget({ prompt: '' }));

    expect(fsHandler).toHaveBeenCalledWith(
      expect.objectContaining({ agentId: 'a1', scheduleId: rowId, key: 'billing/sweep' }),
    );
  });

  it('skips the fire when the handler returns null', async () => {
    const generate = vi.fn(async () => ({}));
    const agent = { sendSignal: vi.fn(), generate, getMemory: vi.fn() };
    const onFinish = vi.fn();
    const mastra = makeMastra({ agent, fsHandler: async () => null, hooks: { onFinish } });

    const result = await executeAgentSchedule(mastra, rowId, makeTarget({ prompt: '' }));

    expect(result.outcome).toBe('skipped');
    expect(generate).not.toHaveBeenCalled();
    expect(onFinish).toHaveBeenCalledWith(expect.objectContaining({ outcome: 'skipped' }));
  });

  it('uses the stored row defaults when the handler returns nothing', async () => {
    const generate = vi.fn(async () => ({}));
    const agent = { sendSignal: vi.fn(), generate, getMemory: vi.fn() };
    const mastra = makeMastra({ agent, fsHandler: async () => undefined });

    const result = await executeAgentSchedule(mastra, rowId, makeTarget({ prompt: 'from the row' }));

    expect(result.status).toBe('fired');
    expect((generate.mock.calls[0] as any[])[0]).toBe('from the row');
  });

  it('fails with a reason when neither the row nor the handler supplies a prompt', async () => {
    const generate = vi.fn(async () => ({}));
    const agent = { sendSignal: vi.fn(), generate, getMemory: vi.fn() };
    const mastra = makeMastra({ agent, fsHandler: async () => ({}) });

    const result = await executeAgentSchedule(mastra, rowId, makeTarget({ prompt: '' }));

    expect(result.status).toBe('invalid-input');
    expect(result.outcome).toBe('failed');
    expect(result.reason).toMatch(/handler returned no prompt/);
    expect(generate).not.toHaveBeenCalled();
  });

  it('reports a throwing handler as invalid input and never runs the agent', async () => {
    const generate = vi.fn(async () => ({}));
    const agent = { sendSignal: vi.fn(), generate, getMemory: vi.fn() };
    const onError = vi.fn();
    const mastra = makeMastra({
      agent,
      hooks: { onError },
      fsHandler: async () => {
        throw new Error('upstream is down');
      },
    });

    const result = await executeAgentSchedule(mastra, rowId, makeTarget({ prompt: '' }));

    expect(result.status).toBe('invalid-input');
    expect(result.reason).toBe('upstream is down');
    expect(generate).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ phase: 'prepare' }));
  });

  it('lets the Mastra-level prepare hook override the handler', async () => {
    const generate = vi.fn(async () => ({}));
    const agent = { sendSignal: vi.fn(), generate, getMemory: vi.fn() };
    const mastra = makeMastra({
      agent,
      fsHandler: async () => ({ prompt: 'from the handler' }),
      hooks: { prepare: async () => ({ prompt: 'from the hook' }) },
    });

    await executeAgentSchedule(mastra, rowId, makeTarget({ prompt: '' }));

    expect((generate.mock.calls[0] as any[])[0]).toBe('from the hook');
  });

  it('runs the handler before the prepare hook, so the hook sees the fire last', async () => {
    const order: string[] = [];
    const generate = vi.fn(async () => ({}));
    const agent = { sendSignal: vi.fn(), generate, getMemory: vi.fn() };
    const mastra = makeMastra({
      agent,
      fsHandler: async () => {
        order.push('handler');
        return { prompt: 'from the handler', tagName: 'from-handler' };
      },
      hooks: {
        prepare: async () => {
          order.push('prepare');
          return { prompt: 'from the hook' };
        },
      },
    });

    await executeAgentSchedule(mastra, rowId, makeTarget({ prompt: '' }));

    expect(order).toEqual(['handler', 'prepare']);
    expect((generate.mock.calls[0] as any[])[0]).toBe('from the hook');
  });

  it('keeps handler overrides the prepare hook does not replace', async () => {
    const sendSignal = vi.fn(() => signalResult({ action: 'wake', runId: 'run-1' }));
    const agent = {
      sendSignal,
      generate: vi.fn(),
      getMemory: vi.fn(async () => ({ getThreadById: async () => ({ id: 'ops' }) })),
    };
    const mastra = makeMastra({
      agent,
      fsHandler: async () => ({ threadId: 'ops', resourceId: 'team', tagName: 'sweep' }),
      hooks: { prepare: async () => ({ prompt: 'from the hook' }) },
    });

    await executeAgentSchedule(mastra, rowId, makeTarget({ prompt: '' }));

    const signal = (sendSignal.mock.calls[0] as any[])[0];
    expect(signal.tagName).toBe('sweep');
    expect(signal.contents).toBe('from the hook');
  });

  it('does not run the prepare hook when the handler skips the fire', async () => {
    const prepare = vi.fn();
    const generate = vi.fn(async () => ({}));
    const agent = { sendSignal: vi.fn(), generate, getMemory: vi.fn() };
    const mastra = makeMastra({ agent, fsHandler: async () => null, hooks: { prepare } });

    const result = await executeAgentSchedule(mastra, rowId, makeTarget({ prompt: '' }));

    expect(result.outcome).toBe('skipped');
    expect(prepare).not.toHaveBeenCalled();
    expect(generate).not.toHaveBeenCalled();
  });

  it('skips when the prepare hook returns null even after the handler supplied a fire', async () => {
    const generate = vi.fn(async () => ({}));
    const agent = { sendSignal: vi.fn(), generate, getMemory: vi.fn() };
    const mastra = makeMastra({
      agent,
      fsHandler: async () => ({ prompt: 'from the handler' }),
      hooks: { prepare: async () => null },
    });

    const result = await executeAgentSchedule(mastra, rowId, makeTarget({ prompt: '' }));

    expect(result.outcome).toBe('skipped');
    expect(generate).not.toHaveBeenCalled();
  });

  it('routes channel delivery through requestContext returned by the handler', async () => {
    const sendSignal = vi.fn(() => signalResult({ action: 'wake', runId: 'run-1' }));
    const agent = {
      sendSignal,
      generate: vi.fn(),
      getMemory: vi.fn(async () => ({ getThreadById: async () => ({ id: 'ops' }) })),
    };
    const mastra = makeMastra({
      agent,
      fsHandler: async () => ({
        prompt: 'go',
        threadId: 'ops',
        resourceId: 'team',
        ifIdle: { behavior: 'wake', streamOptions: { requestContext: { channel: 'slack' } } },
      }),
    });

    await executeAgentSchedule(mastra, rowId, makeTarget({ prompt: '' }));

    const options = (sendSignal.mock.calls[0] as any[])[1];
    expect(options.ifIdle.streamOptions.requestContext.get('channel')).toBe('slack');
  });
});
