import { describe, expect, it, vi } from 'vitest';
import type { Mastra } from '../../mastra';
import type { HeartbeatInput } from './types';
import { __internal, isWithinActiveHours } from './workflow';

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

function baseInput(overrides: Partial<HeartbeatInput> = {}): HeartbeatInput {
  return {
    scheduleId: 'hb_a1',
    agentId: 'a1',
    prompt: 'check in',
    ...overrides,
  };
}

describe('heartbeat workflow — executeHeartbeat', () => {
  it('returns agent-missing and self-cleans when the agent is unregistered', async () => {
    const storage = makeStorage();
    const mastra = makeMastra({ agentThrows: true, storage });

    const result = await __internal.executeHeartbeat(mastra, baseInput());

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

    const result = await __internal.executeHeartbeat(mastra, baseInput({ threadId: 't1', resourceId: 'r1' }));

    expect(result.status).toBe('thread-missing');
    expect(storage.deleteSchedule).toHaveBeenCalledWith('hb_a1');
    expect(sendSignal).not.toHaveBeenCalled();
  });

  it('rejects threaded input that omits resourceId', async () => {
    const agent = { sendSignal: vi.fn(), generate: vi.fn(), getMemory: vi.fn() };
    const mastra = makeMastra({ agent });

    const result = await __internal.executeHeartbeat(mastra, baseInput({ threadId: 't1' }));

    expect(result.status).toBe('invalid-input');
    expect(agent.sendSignal).not.toHaveBeenCalled();
  });

  it('calls sendSignal with defaults when threaded', async () => {
    const sendSignal = vi.fn();
    const agent = {
      sendSignal,
      generate: vi.fn(),
      getMemory: vi.fn(async () => ({
        getThreadById: vi.fn(async () => ({ id: 't1', updatedAt: new Date(Date.now() - 60_000) })),
      })),
    };
    const mastra = makeMastra({ agent });

    const result = await __internal.executeHeartbeat(
      mastra,
      baseInput({ threadId: 't1', resourceId: 'r1', prompt: 'ping' }),
    );

    expect(result.status).toBe('signal-accepted');
    expect(sendSignal).toHaveBeenCalledTimes(1);
    const [signal, target] = sendSignal.mock.calls[0]!;
    expect(signal).toEqual({ type: 'user-message', contents: 'ping' });
    expect(target).toMatchObject({
      threadId: 't1',
      resourceId: 'r1',
      ifActive: { behavior: 'discard' },
      ifIdle: { behavior: 'wake' },
    });
  });

  it('forwards signalType, ifActive, ifIdle to sendSignal', async () => {
    const sendSignal = vi.fn();
    const agent = {
      sendSignal,
      generate: vi.fn(),
      getMemory: vi.fn(async () => ({
        getThreadById: vi.fn(async () => ({ id: 't1', updatedAt: new Date(0) })),
      })),
    };
    const mastra = makeMastra({ agent });

    await __internal.executeHeartbeat(
      mastra,
      baseInput({
        threadId: 't1',
        resourceId: 'r1',
        signalType: 'system-reminder',
        ifActive: 'deliver',
        ifIdle: 'persist',
      }),
    );

    const [signal, target] = sendSignal.mock.calls[0]!;
    expect(signal.type).toBe('system-reminder');
    expect(target.ifActive).toEqual({ behavior: 'deliver' });
    expect(target.ifIdle).toEqual({ behavior: 'persist' });
  });

  it('skips when the thread updated within idleThresholdMs', async () => {
    const sendSignal = vi.fn();
    const agent = {
      sendSignal,
      generate: vi.fn(),
      getMemory: vi.fn(async () => ({
        getThreadById: vi.fn(async () => ({ id: 't1', updatedAt: new Date(Date.now() - 1_000) })),
      })),
    };
    const mastra = makeMastra({ agent });

    const result = await __internal.executeHeartbeat(
      mastra,
      baseInput({ threadId: 't1', resourceId: 'r1', idleThresholdMs: 30_000 }),
    );

    expect(result.status).toBe('skipped-idle-threshold');
    expect(sendSignal).not.toHaveBeenCalled();
  });

  it('calls agent.generate in threadless mode', async () => {
    const generate = vi.fn(async () => ({}));
    const sendSignal = vi.fn();
    const agent = { sendSignal, generate, getMemory: vi.fn() };
    const mastra = makeMastra({ agent });

    const result = await __internal.executeHeartbeat(mastra, baseInput({ prompt: 'tick' }));

    expect(result.status).toBe('fired');
    expect(generate).toHaveBeenCalledWith('tick');
    expect(sendSignal).not.toHaveBeenCalled();
  });

  it('skips when outside active hours', async () => {
    const sendSignal = vi.fn();
    const generate = vi.fn();
    const agent = { sendSignal, generate, getMemory: vi.fn() };
    const mastra = makeMastra({ agent });

    // Pick a window definitely not "now"
    const now = new Date();
    const hour = now.getUTCHours();
    const startHour = (hour + 2) % 24;
    const endHour = (hour + 3) % 24;
    const pad = (n: number) => n.toString().padStart(2, '0');

    const result = await __internal.executeHeartbeat(
      mastra,
      baseInput({
        activeHours: { start: `${pad(startHour)}:00`, end: `${pad(endHour)}:00`, timezone: 'UTC' },
      }),
    );

    expect(result.status).toBe('skipped-outside-hours');
    expect(generate).not.toHaveBeenCalled();
    expect(sendSignal).not.toHaveBeenCalled();
  });

  it('does not self-clean on regular outcomes', async () => {
    const storage = makeStorage();
    const agent = { sendSignal: vi.fn(), generate: vi.fn(async () => ({})), getMemory: vi.fn() };
    const mastra = makeMastra({ agent, storage });

    await __internal.executeHeartbeat(mastra, baseInput());
    expect(storage.deleteSchedule).not.toHaveBeenCalled();
  });
});

describe('isWithinActiveHours', () => {
  // Use UTC to avoid host-tz flakiness.
  const at = (h: number, m = 0) => Date.UTC(2026, 0, 1, h, m);

  it('returns true inside a non-wrapping window', () => {
    expect(isWithinActiveHours({ start: '09:00', end: '17:00', timezone: 'UTC' }, at(12))).toBe(true);
  });

  it('returns false outside a non-wrapping window', () => {
    expect(isWithinActiveHours({ start: '09:00', end: '17:00', timezone: 'UTC' }, at(8))).toBe(false);
    expect(isWithinActiveHours({ start: '09:00', end: '17:00', timezone: 'UTC' }, at(17))).toBe(false);
  });

  it('handles wrapping (overnight) windows', () => {
    const win = { start: '22:00', end: '06:00', timezone: 'UTC' };
    expect(isWithinActiveHours(win, at(23))).toBe(true);
    expect(isWithinActiveHours(win, at(2))).toBe(true);
    expect(isWithinActiveHours(win, at(12))).toBe(false);
  });
});
