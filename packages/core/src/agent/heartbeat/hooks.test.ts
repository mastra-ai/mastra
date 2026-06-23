import { describe, expect, it, vi } from 'vitest';
import type { Mastra } from '../../mastra';
import type { ScheduleTarget } from '../../storage/domains/schedules/base';
import type { HeartbeatHooks } from './types';
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
    | { action: 'discard' },
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

function makeMastra(opts: { agent?: any; storage?: ReturnType<typeof makeStorage> } = {}) {
  const storage = opts.storage ?? makeStorage();
  return {
    storage,
    getStorage: () => storage,
    getAgentById: vi.fn(() => {
      if (!opts.agent) throw new Error('not found');
      return opts.agent;
    }),
    getLogger: () => ({ debug: vi.fn(), error: vi.fn(), warn: vi.fn(), info: vi.fn() }),
    heartbeats: {
      get: vi.fn(async () => null),
    },
    __getHeartbeatHooks: () => opts.agent?.__getHeartbeatHooks?.(),
  } as unknown as Mastra;
}

function makeTarget(overrides: Partial<HeartbeatTarget> = {}): HeartbeatTarget {
  return {
    type: 'heartbeat',
    agentId: 'a1',
    prompt: 'row prompt',
    ...overrides,
  } as HeartbeatTarget;
}

function makeAgent(
  opts: {
    hooks?: HeartbeatHooks;
    sendSignal?: ReturnType<typeof vi.fn>;
    generate?: ReturnType<typeof vi.fn>;
    threadExists?: boolean;
  } = {},
) {
  return {
    sendSignal: opts.sendSignal ?? vi.fn(() => signalResult({ action: 'wake', runId: 'run-x' })),
    generate: opts.generate ?? vi.fn(async () => ({ runId: 'gen-run', text: 'ok' })),
    getMemory: vi.fn(async () => ({
      getThreadById: vi.fn(async () => (opts.threadExists === false ? null : { id: 't1', updatedAt: new Date(0) })),
    })),
    __getHeartbeatHooks: () => opts.hooks,
  };
}

describe('HeartbeatWorker — lifecycle hooks', () => {
  it('prepare returning overrides changes effective values used by sendSignal', async () => {
    const sendSignal: any = vi.fn(() => signalResult({ action: 'wake', runId: 'r1' }));
    const prepare = vi.fn(() => ({ threadId: 'new-thread', resourceId: 'new-res', prompt: 'hooked prompt' }));
    const onFinish = vi.fn();
    const agent = makeAgent({ hooks: { prepare, onFinish }, sendSignal });
    const mastra = makeMastra({ agent });

    const result = await executeHeartbeat(mastra, 'hb1', makeTarget({ prompt: 'row prompt' }));

    expect(result.outcome).toBe('succeeded');
    expect(sendSignal).toHaveBeenCalledTimes(1);
    const [signal, target] = sendSignal.mock.calls[0]!;
    expect(signal.contents).toBe('hooked prompt');
    expect(target.threadId).toBe('new-thread');
    expect(target.resourceId).toBe('new-res');
    expect(onFinish).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: 'succeeded',
        runId: 'r1',
        effective: expect.objectContaining({ threadId: 'new-thread', prompt: 'hooked prompt' }),
      }),
    );
  });

  it('prepare returning null skips the fire and fires onFinish with outcome=skipped', async () => {
    const prepare = vi.fn(async () => null);
    const onFinish = vi.fn();
    const sendSignal: any = vi.fn();
    const generate = vi.fn();
    const agent = makeAgent({ hooks: { prepare, onFinish }, sendSignal, generate });
    const mastra = makeMastra({ agent });

    const result = await executeHeartbeat(mastra, 'hb1', makeTarget({ threadId: 't1', resourceId: 'r1' }));

    expect(result.outcome).toBe('skipped');
    expect(sendSignal).not.toHaveBeenCalled();
    expect(generate).not.toHaveBeenCalled();
    expect(onFinish).toHaveBeenCalledWith(expect.objectContaining({ outcome: 'skipped' }));
  });

  it('prepare returning undefined uses row defaults', async () => {
    const sendSignal: any = vi.fn(() => signalResult({ action: 'wake', runId: 'r2' }));
    const prepare = vi.fn(() => undefined);
    const agent = makeAgent({ hooks: { prepare }, sendSignal });
    const mastra = makeMastra({ agent });

    await executeHeartbeat(mastra, 'hb1', makeTarget({ threadId: 't1', resourceId: 'r1', prompt: 'row prompt' }));

    const [signal] = sendSignal.mock.calls[0]!;
    expect(signal.contents).toBe('row prompt');
  });

  it('prepare throwing triggers onError(phase: prepare) and returns failed', async () => {
    const err = new Error('boom');
    const prepare = vi.fn(async () => {
      throw err;
    });
    const onError = vi.fn();
    const onFinish = vi.fn();
    const sendSignal: any = vi.fn();
    const agent = makeAgent({ hooks: { prepare, onError, onFinish }, sendSignal });
    const mastra = makeMastra({ agent });

    const result = await executeHeartbeat(mastra, 'hb1', makeTarget({ threadId: 't1', resourceId: 'r1' }));

    expect(result.outcome).toBe('failed');
    expect(sendSignal).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ phase: 'prepare', error: err }));
    expect(onFinish).not.toHaveBeenCalled();
  });

  it('threaded succeeded path emits onFinish(outcome: succeeded)', async () => {
    const onFinish = vi.fn();
    const sendSignal: any = vi.fn(() => signalResult({ action: 'wake', runId: 'r3' }));
    const agent = makeAgent({ hooks: { onFinish }, sendSignal });
    const mastra = makeMastra({ agent });

    await executeHeartbeat(mastra, 'hb1', makeTarget({ threadId: 't1', resourceId: 'r1' }));

    expect(onFinish).toHaveBeenCalledWith(expect.objectContaining({ outcome: 'succeeded', runId: 'r3' }));
  });

  it('passes agentId into the hook context (flat hooks, keyed by ctx.agentId)', async () => {
    const prepare = vi.fn(() => undefined);
    const onFinish = vi.fn();
    const sendSignal: any = vi.fn(() => signalResult({ action: 'wake', runId: 'r5' }));
    const agent = makeAgent({ hooks: { prepare, onFinish }, sendSignal });
    const mastra = makeMastra({ agent });

    await executeHeartbeat(mastra, 'hb1', makeTarget({ agentId: 'a1', threadId: 't1', resourceId: 'r1' }));

    expect(prepare).toHaveBeenCalledWith(expect.objectContaining({ agentId: 'a1' }));
    expect(onFinish).toHaveBeenCalledWith(expect.objectContaining({ agentId: 'a1', outcome: 'succeeded' }));
  });

  it('threaded delivered path emits onFinish(outcome: delivered, joinedExistingRun: true)', async () => {
    const onFinish = vi.fn();
    const sendSignal: any = vi.fn(() => signalResult({ action: 'deliver', runId: 'r4' }));
    const agent = makeAgent({ hooks: { onFinish }, sendSignal });
    const mastra = makeMastra({ agent });

    const result = await executeHeartbeat(mastra, 'hb1', makeTarget({ threadId: 't1', resourceId: 'r1' }));

    expect(result.outcome).toBe('delivered');
    expect(onFinish).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'delivered', runId: 'r4', joinedExistingRun: true }),
    );
  });

  it('threaded persisted path emits onFinish(outcome: persisted)', async () => {
    const onFinish = vi.fn();
    const sendSignal: any = vi.fn(() => signalResult({ action: 'persist' }, { persisted: Promise.resolve() }));
    const agent = makeAgent({ hooks: { onFinish }, sendSignal });
    const mastra = makeMastra({ agent });

    const result = await executeHeartbeat(mastra, 'hb1', makeTarget({ threadId: 't1', resourceId: 'r1' }));

    expect(result.outcome).toBe('persisted');
    // `persist` carries no runId under the accepted API — the asymmetric union
    // only stamps a runId on `wake`/`deliver`.
    expect(onFinish).toHaveBeenCalledWith(expect.objectContaining({ outcome: 'persisted', runId: undefined }));
  });

  it('threaded discarded path emits onFinish(outcome: discarded)', async () => {
    const onFinish = vi.fn();
    const sendSignal: any = vi.fn(() => signalResult({ action: 'discard' }));
    const agent = makeAgent({ hooks: { onFinish }, sendSignal });
    const mastra = makeMastra({ agent });

    const result = await executeHeartbeat(mastra, 'hb1', makeTarget({ threadId: 't1', resourceId: 'r1' }));

    expect(result.outcome).toBe('discarded');
    // `discard` carries no runId under the accepted API.
    expect(onFinish).toHaveBeenCalledWith(expect.objectContaining({ outcome: 'discarded', runId: undefined }));
  });

  it('threadless succeeded path emits onFinish(outcome: succeeded) with result snapshot', async () => {
    const onFinish = vi.fn();
    const generate = vi.fn(async () => ({
      runId: 'gen-1',
      text: 'reply',
      usage: { promptTokens: 5, completionTokens: 7 },
      finishReason: 'stop',
    }));
    const agent = makeAgent({ hooks: { onFinish }, generate });
    const mastra = makeMastra({ agent });

    const result = await executeHeartbeat(mastra, 'hb1', makeTarget());

    expect(result.outcome).toBe('succeeded');
    expect(onFinish).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: 'succeeded',
        runId: 'gen-1',
        result: { text: 'reply', usage: { promptTokens: 5, completionTokens: 7 }, finishReason: 'stop' },
      }),
    );
  });

  it('threadless agent.generate throwing triggers onError(phase: run)', async () => {
    const onError = vi.fn();
    const err = new Error('llm error');
    const generate = vi.fn(async () => {
      throw err;
    });
    const agent = makeAgent({ hooks: { onError }, generate });
    const mastra = makeMastra({ agent });

    const result = await executeHeartbeat(mastra, 'hb1', makeTarget());

    expect(result.outcome).toBe('failed');
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ phase: 'run', error: err }));
  });

  it('threadless aborted run triggers onAbort, not onError', async () => {
    const onAbort = vi.fn();
    const onError = vi.fn();
    const abortErr = Object.assign(new Error('aborted'), { name: 'AbortError' });
    const generate = vi.fn(async () => {
      throw abortErr;
    });
    const agent = makeAgent({ hooks: { onAbort, onError }, generate });
    const mastra = makeMastra({ agent });

    const result = await executeHeartbeat(mastra, 'hb1', makeTarget());

    expect(result.outcome).toBe('aborted');
    expect(onAbort).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalled();
  });

  it('hook exceptions are logged but never recurse or re-route', async () => {
    const loggerError = vi.fn();
    const onFinish = vi.fn(() => {
      throw new Error('hook boom');
    });
    const sendSignal: any = vi.fn(() => signalResult({ action: 'wake', runId: 'r7' }));
    const agent = makeAgent({ hooks: { onFinish }, sendSignal });
    const mastra = makeMastra({ agent });

    const result = await executeHeartbeat(mastra, 'hb1', makeTarget({ threadId: 't1', resourceId: 'r1' }), {
      logger: { error: loggerError },
    });

    expect(result.outcome).toBe('succeeded');
    expect(loggerError).toHaveBeenCalled();
  });

  it('no hooks configured → execution still works (regression guard)', async () => {
    const sendSignal: any = vi.fn(() => signalResult({ action: 'wake', runId: 'r8' }));
    const agent = {
      sendSignal,
      generate: vi.fn(),
      getMemory: vi.fn(async () => ({ getThreadById: vi.fn(async () => ({ id: 't1', updatedAt: new Date(0) })) })),
      // __getHeartbeatHooks intentionally omitted
    };
    const mastra = makeMastra({ agent });

    const result = await executeHeartbeat(mastra, 'hb1', makeTarget({ threadId: 't1', resourceId: 'r1' }));

    expect(result.outcome).toBe('succeeded');
  });

  it('trigger info carries kind=manual when ctx.triggerKind is manual', async () => {
    const prepare = vi.fn(() => undefined);
    const onFinish = vi.fn();
    const sendSignal: any = vi.fn(() => signalResult({ action: 'wake', runId: 'r9' }));
    const agent = makeAgent({ hooks: { prepare, onFinish }, sendSignal });
    const mastra = makeMastra({ agent });

    await executeHeartbeat(mastra, 'hb1', makeTarget({ threadId: 't1', resourceId: 'r1' }), {
      triggerKind: 'manual',
    });

    expect(prepare).toHaveBeenCalledWith(
      expect.objectContaining({ trigger: expect.objectContaining({ kind: 'manual' }) }),
    );
    expect(onFinish).toHaveBeenCalledWith(
      expect.objectContaining({ trigger: expect.objectContaining({ kind: 'manual' }) }),
    );
  });
});
