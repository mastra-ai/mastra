import { describe, expect, it, vi } from 'vitest';

import { createFactoryStorageForTests } from '../storage/test-utils.js';
import {
  FACTORY_OPEN_RUN_STALE_MS,
  FACTORY_OPEN_RUNS_SETTING,
  heartbeatSessionOpenRun,
  isOpenRunLiveElsewhere,
  listSessionOpenRuns,
  observeSessionRunEnd,
  recordSessionRunStart,
} from './run-audit.js';
import type { RunEndCaptureSession } from './run-audit.js';

const OPEN_RUN = {
  kickoffId: 'kickoff-1',
  bindingId: 'binding-1',
  role: 'work',
  startedBy: 'approver-2',
  orgId: 'org-1',
  factoryProjectId: 'project-1',
  workItemId: 'item-1',
  sessionId: 'session-1',
  threadId: 'thread-1',
  branch: 'factory/issue-1',
};

function makeSession() {
  const settings: Record<string, unknown> = {};
  const listeners = new Set<Parameters<RunEndCaptureSession['subscribe']>[0]>();
  const session: RunEndCaptureSession = {
    thread: {
      getSetting: async ({ key }) => settings[key],
      setSetting: async ({ key, value }) => {
        settings[key] = value;
      },
    },
    mode: { get: () => 'work' },
    subscribe: listener => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  return {
    session,
    settings,
    emit: (reason: 'complete' | 'error' | 'suspended') => {
      for (const listener of listeners) listener({ type: 'agent_end', reason });
    },
  };
}

async function setup() {
  const { audit } = await createFactoryStorageForTests();
  const capture = makeSession();
  observeSessionRunEnd(capture.session, { audit });
  const start = (run = OPEN_RUN, reason?: 'complete' | 'error') =>
    recordSessionRunStart(capture.session, { audit, run, actorType: 'human', observedEnd: () => reason });
  const events = async () => (await audit.list({ orgId: 'org-1' })).events;
  return { ...capture, audit, start, events };
}

describe('Factory run lifecycle audit', () => {
  it('exposes the validated open runs used by dispatch admission', async () => {
    const { session, settings } = makeSession();
    const stored = { ...OPEN_RUN, agentName: 'build' };
    settings[FACTORY_OPEN_RUNS_SETTING] = [stored];

    await expect(listSessionOpenRuns(session)).resolves.toEqual([stored]);
  });

  it('accepts ledger entries written before ownership was recorded', async () => {
    const { session, settings } = makeSession();
    settings[FACTORY_OPEN_RUNS_SETTING] = [{ ...OPEN_RUN, agentName: 'build' }];

    const [entry] = await listSessionOpenRuns(session);
    expect(isOpenRunLiveElsewhere(entry!, 'worker-2')).toBe(false);
  });

  it('treats only a fresh heartbeat from a different owner as live elsewhere', () => {
    const now = 1_000_000;
    const entry = { ...OPEN_RUN, agentName: 'build', ownerId: 'worker-1', heartbeatAt: now };
    expect(isOpenRunLiveElsewhere(entry, 'worker-2', now)).toBe(true);
    expect(isOpenRunLiveElsewhere(entry, 'worker-1', now)).toBe(false);
    expect(isOpenRunLiveElsewhere(entry, 'worker-2', now + FACTORY_OPEN_RUN_STALE_MS)).toBe(false);
    expect(isOpenRunLiveElsewhere({ ...entry, heartbeatAt: undefined }, 'worker-2', now)).toBe(false);
  });

  it('renews the heartbeat of an open run and keeps ownership out of the audit record', async () => {
    const { session, start, settings, events } = await setup();
    await start({ ...OPEN_RUN, ownerId: 'worker-1', heartbeatAt: 1 });
    await heartbeatSessionOpenRun(session, 'kickoff-1', 2);
    await heartbeatSessionOpenRun(session, 'someone-else', 3);

    expect(settings[FACTORY_OPEN_RUNS_SETTING]).toEqual([
      expect.objectContaining({ kickoffId: 'kickoff-1', ownerId: 'worker-1', heartbeatAt: 2 }),
    ]);
    const [started] = await events();
    expect(started!.metadata).not.toHaveProperty('ownerId');
    expect(started!.metadata).not.toHaveProperty('heartbeatAt');
  });

  it('retains both kickoffs when roles hand off within the same agent turn', async () => {
    const { start, emit, events, settings } = await setup();
    await start({ ...OPEN_RUN, kickoffId: 'plan', role: 'plan' });
    await start({ ...OPEN_RUN, kickoffId: 'work', role: 'work' });
    emit('complete');

    await vi.waitFor(async () => expect(await events()).toHaveLength(4));
    const ended = (await events()).filter(event => event.action === 'factory.run.ended');
    expect(ended.map(event => event.metadata.kickoffId).sort()).toEqual(['plan', 'work']);
    expect(ended.every(event => event.metadata.startedBy === 'approver-2')).toBe(true);
    expect(settings[FACTORY_OPEN_RUNS_SETTING]).toEqual([]);
  });

  it('deduplicates concurrent starts and duplicate terminal events', async () => {
    const { start, emit, events } = await setup();
    await Promise.all([start(), start()]);
    emit('complete');
    emit('error');

    await vi.waitFor(async () => expect(await events()).toHaveLength(2));
    const ended = (await events()).find(event => event.action === 'factory.run.ended');
    expect(ended).toMatchObject({
      actorId: 'agent:thread-1',
      metadata: { reason: 'complete', startedBy: 'approver-2' },
    });
  });

  it('keeps a suspended kickoff open until it resumes and ends', async () => {
    const { start, emit, events, settings } = await setup();
    await start();
    emit('suspended');
    expect(await events()).toHaveLength(1);
    expect(settings[FACTORY_OPEN_RUNS_SETTING]).toHaveLength(1);

    emit('error');
    await vi.waitFor(async () => expect(await events()).toHaveLength(2));
    expect((await events()).find(event => event.action === 'factory.run.ended')?.metadata.reason).toBe('error');
  });

  it('records a run that finishes before its delivery acknowledgement', async () => {
    const { start, emit, events } = await setup();
    emit('complete');
    await start(OPEN_RUN, 'complete');
    expect((await events()).map(event => event.action).sort()).toEqual(['factory.run.ended', 'factory.run.started']);
  });

  it('leaves an end recoverable when the audit store is temporarily unavailable', async () => {
    const { start, emit, events, audit, settings } = await setup();
    await start();
    const failure = vi.spyOn(audit, 'record').mockRejectedValueOnce(new Error('store unavailable'));
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    emit('complete');
    await vi.waitFor(() => expect(warning).toHaveBeenCalledOnce());
    expect(settings[FACTORY_OPEN_RUNS_SETTING]).toHaveLength(1);
    failure.mockRestore();
    emit('complete');
    await vi.waitFor(async () => expect(await events()).toHaveLength(2));
    warning.mockRestore();
  });

  it('ignores ordinary conversation turns without a Factory kickoff', async () => {
    const { emit, events } = await setup();
    emit('complete');
    await new Promise(resolve => setImmediate(resolve));
    expect(await events()).toEqual([]);
  });
});
