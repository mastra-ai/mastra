import { describe, expect, it, vi } from 'vitest';

import { createFactoryStorageForTests } from '../storage/test-utils.js';
import {
  FACTORY_OPEN_RUN_STALE_MS,
  FACTORY_OPEN_RUNS_SETTING,
  FACTORY_RUN_USAGE_STEPS_JSON_BUDGET,
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
    step: (promptTokens: number, completionTokens: number, extra: { cachedInputTokens?: number } = {}) => {
      const usage = { promptTokens, completionTokens, totalTokens: promptTokens + completionTokens, ...extra };
      for (const listener of listeners) listener({ type: 'usage_update', usage });
    },
  };
}

async function setup() {
  const { audit } = await createFactoryStorageForTests();
  const capture = makeSession();
  observeSessionRunEnd(capture.session, { audit });
  const start = (run = OPEN_RUN, reason?: 'complete' | 'error') =>
    recordSessionRunStart(capture.session, {
      audit,
      run,
      actorType: 'human',
      observedEnd: () => reason,
      startedAt: new Date(),
    });
  const events = async () => (await audit.list({ orgId: 'org-1' })).events;
  return { ...capture, audit, start, events };
}

describe('Factory run lifecycle audit', () => {
  it('exposes the validated open runs used by dispatch admission', async () => {
    const { session, settings } = makeSession();
    settings[FACTORY_OPEN_RUNS_SETTING] = [OPEN_RUN];

    await expect(listSessionOpenRuns(session)).resolves.toEqual([OPEN_RUN]);
  });

  it('given a run opened before modes were removed, when the ledger is read, then the entry still parses', async () => {
    const { session, settings } = makeSession();
    settings[FACTORY_OPEN_RUNS_SETTING] = [{ ...OPEN_RUN, agentName: 'plan agent' }];

    await expect(listSessionOpenRuns(session)).resolves.toEqual([OPEN_RUN]);
  });

  it('accepts ledger entries written before ownership was recorded', async () => {
    const { session, settings } = makeSession();
    settings[FACTORY_OPEN_RUNS_SETTING] = [OPEN_RUN];

    const [entry] = await listSessionOpenRuns(session);
    expect(isOpenRunLiveElsewhere(entry!, 'worker-2')).toBe(false);
  });

  it('treats only a fresh heartbeat from a different owner as live elsewhere', () => {
    const now = 1_000_000;
    const entry = { ...OPEN_RUN, ownerId: 'worker-1', heartbeatAt: now };
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

  describe('token usage (#23883)', () => {
    const ended = async (events: () => Promise<Array<{ action: string; metadata?: Record<string, unknown> | null }>>) =>
      (await events()).filter(event => event.action === 'factory.run.ended').map(event => event.metadata);

    it('records each step of a run, across a suspend and resume, on its end record under its role', async () => {
      const { start, emit, step, events } = await setup();
      await start();
      step(100, 50, { cachedInputTokens: 40 });
      emit('suspended');
      step(30, 10);
      emit('complete');

      await vi.waitFor(async () => expect(await ended(events)).toHaveLength(1));
      const [metadata] = await ended(events);
      expect(metadata).toMatchObject({ role: 'work', kickoffId: 'kickoff-1', reason: 'complete' });
      expect(metadata?.usage).toEqual({
        status: 'recorded',
        stepCount: 2,
        totals: { promptTokens: 130, completionTokens: 60, totalTokens: 190, cachedInputTokens: 40 },
        steps: [
          { promptTokens: 100, completionTokens: 50, totalTokens: 150, cachedInputTokens: 40 },
          { promptTokens: 30, completionTokens: 10, totalTokens: 40 },
        ],
      });
    });

    it('keeps each role run to its own usage', async () => {
      const { audit } = await createFactoryStorageForTests();
      const work = makeSession();
      const review = makeSession();
      for (const [capture, role] of [
        [work, 'work'],
        [review, 'review'],
      ] as const) {
        observeSessionRunEnd(capture.session, { audit });
        await recordSessionRunStart(capture.session, {
          audit,
          run: { ...OPEN_RUN, kickoffId: `kickoff-${role}`, role, threadId: `thread-${role}` },
          actorType: 'human',
          observedEnd: () => undefined,
          startedAt: new Date(),
        });
      }
      work.step(1000, 200);
      review.step(10, 5);
      work.emit('complete');
      review.emit('complete');

      const ends = async () =>
        (await audit.list({ orgId: 'org-1' })).events.filter(event => event.action === 'factory.run.ended');
      await vi.waitFor(async () => expect(await ends()).toHaveLength(2));
      const totalsByRole = Object.fromEntries(
        (await ends()).map(event => [
          event.metadata?.role,
          (event.metadata?.usage as { totals: Record<string, number> }).totals.totalTokens,
        ]),
      );
      expect(totalsByRole).toEqual({ work: 1200, review: 15 });
    });

    it('marks a run with no reported usage as unreported, never as zero spend', async () => {
      const { start, emit, events } = await setup();
      await start();
      emit('complete');

      await vi.waitFor(async () => expect(await ended(events)).toHaveLength(1));
      expect((await ended(events))[0]?.usage).toEqual({ status: 'unreported' });
    });

    it('does not bill a conversation turn without a kickoff to the next run', async () => {
      const { start, emit, step, events } = await setup();
      step(500, 500);
      emit('complete');
      await start();
      step(5, 5);
      emit('complete');

      await vi.waitFor(async () => expect(await ended(events)).toHaveLength(1));
      expect((await ended(events))[0]?.usage).toMatchObject({ status: 'recorded', totals: { totalTokens: 10 } });
    });

    it('bills a run whose turn ended before its ledger entry was written', async () => {
      const { emit, step, start, events } = await setup();
      step(7, 3);
      emit('complete');
      await start(OPEN_RUN, 'complete');

      await vi.waitFor(async () => expect(await ended(events)).toHaveLength(1));
      expect((await ended(events))[0]?.usage).toMatchObject({ status: 'recorded', totals: { totalTokens: 10 } });
    });

    it('does not bill an earlier conversation turn to a run that ended without usage before its ledger entry', async () => {
      const { emit, step, start, events } = await setup();
      step(500, 500);
      emit('complete');
      // The run's turn fails before any usage arrives, and its end is written before its start.
      emit('error');
      await start(OPEN_RUN, 'error');

      await vi.waitFor(async () => expect(await ended(events)).toHaveLength(1));
      expect((await ended(events))[0]?.usage).toEqual({ status: 'unreported' });
    });

    it('does not bill an earlier conversation turn to a run whose start is written before its usage-less end', async () => {
      const { emit, step, start, events } = await setup();
      step(500, 500);
      emit('complete');
      const started = start(OPEN_RUN, 'error');
      emit('error');
      await started;

      await vi.waitFor(async () => expect(await ended(events)).toHaveLength(1));
      expect((await ended(events))[0]?.usage).toEqual({ status: 'unreported' });
    });

    it('bills each queued end the turn it closed, not a later turn', async () => {
      const { start, emit, step, events } = await setup();
      await start();
      step(7, 3);
      emit('complete');
      step(400, 100);
      emit('complete');

      await vi.waitFor(async () => expect(await ended(events)).toHaveLength(1));
      expect((await ended(events))[0]?.usage).toMatchObject({ status: 'recorded', totals: { totalTokens: 10 } });
    });

    it('bills a turn to only one run when two ledger entries land after it ended', async () => {
      const { start, emit, step, events } = await setup();
      step(7, 3);
      emit('complete');
      await start(OPEN_RUN, 'complete');
      await start({ ...OPEN_RUN, kickoffId: 'kickoff-2' }, 'complete');

      await vi.waitFor(async () => expect(await ended(events)).toHaveLength(2));
      const byKickoff = Object.fromEntries((await ended(events)).map(meta => [meta?.kickoffId, meta?.usage]));
      expect(byKickoff['kickoff-1']).toMatchObject({ status: 'recorded', totals: { totalTokens: 10 } });
      expect(byKickoff['kickoff-2']).toEqual({ status: 'unreported' });
    });

    it('warns when a run end cannot persist its usage, and persists the same usage on the retry', async () => {
      const { start, emit, step, events, audit, settings } = await setup();
      await start();
      step(100, 50);
      const failure = vi.spyOn(audit, 'record').mockResolvedValueOnce(null);
      const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
      emit('complete');

      await vi.waitFor(() =>
        expect(warning).toHaveBeenCalledWith(
          '[Factory run audit] Token usage for run kickoff-1 (work) was not persisted; keeping it for the next attempt.',
          expect.objectContaining({ status: 'recorded', totals: expect.objectContaining({ totalTokens: 150 }) }),
        ),
      );
      expect(settings[FACTORY_OPEN_RUNS_SETTING]).toHaveLength(1);
      failure.mockRestore();
      warning.mockRestore();

      emit('complete');
      await vi.waitFor(async () => expect(await ended(events)).toHaveLength(1));
      expect((await ended(events))[0]?.usage).toMatchObject({ status: 'recorded', totals: { totalTokens: 150 } });
      expect(settings[FACTORY_OPEN_RUNS_SETTING]).toEqual([]);
    });

    it('keeps a long run inside the audit metadata bound: drops late steps, totals every step', async () => {
      const { start, emit, step, events } = await setup();
      await start();
      const steps = 400;
      for (let i = 0; i < steps; i++) step(12_000, 800, { cachedInputTokens: 9_000 });
      emit('complete');

      await vi.waitFor(async () => expect(await ended(events)).toHaveLength(1));
      const [metadata] = await ended(events);
      expect(metadata).toMatchObject({ role: 'work', kickoffId: 'kickoff-1' });
      const usage = metadata?.usage as { stepCount: number; steps: unknown[]; stepsTruncated: number; totals: object };
      expect(JSON.stringify(usage.steps).length).toBeLessThanOrEqual(FACTORY_RUN_USAGE_STEPS_JSON_BUDGET);
      expect(usage.steps.length).toBeGreaterThan(0);
      expect(usage.stepCount).toBe(steps);
      expect(usage.steps.length + usage.stepsTruncated).toBe(steps);
      expect(usage.totals).toMatchObject({ totalTokens: steps * 12_800, cachedInputTokens: steps * 9_000 });
    });
  });

  it('ignores ordinary conversation turns without a Factory kickoff', async () => {
    const { emit, events } = await setup();
    emit('complete');
    await new Promise(resolve => setImmediate(resolve));
    expect(await events()).toEqual([]);
  });
});
