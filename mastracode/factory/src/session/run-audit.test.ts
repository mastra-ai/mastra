import { describe, expect, it, vi } from 'vitest';

import { createFactoryStorageForTests } from '../storage/test-utils.js';
import {
  FACTORY_LEGACY_OPEN_RUNS_READ,
  FACTORY_OPEN_RUN_STALE_MS,
  FACTORY_OPEN_RUNS_SETTING,
  FACTORY_RUN_USAGE_STEPS_JSON_BUDGET,
  heartbeatSessionOpenRun,
  isOpenRunLiveElsewhere,
  listSessionOpenRuns,
  observeSessionRunEnd,
  recordSessionRunStart,
  takeOverInterruptedSessionRuns,
  waitForSessionRunAudit,
} from './run-audit.js';
import type { FactoryOpenRun, RunEndCaptureSession } from './run-audit.js';

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

function makeSession(threadId = 'thread-1') {
  const settings: Record<string, unknown> = {};
  const listeners = new Set<Parameters<RunEndCaptureSession['subscribe']>[0]>();
  const session: RunEndCaptureSession = {
    thread: {
      getId: () => threadId,
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
  const { audit, openRuns } = await createFactoryStorageForTests();
  const capture = makeSession();
  observeSessionRunEnd(capture.session, { audit, openRuns });
  const start = (run: FactoryOpenRun = OPEN_RUN, reason?: 'complete' | 'error') =>
    recordSessionRunStart(capture.session, { audit, openRuns, run, actorType: 'human', observedEnd: () => reason });
  const events = async () => (await audit.list({ orgId: 'org-1' })).events;
  const ledger = () => openRuns.listByThread('thread-1');
  return { ...capture, audit, openRuns, start, events, ledger };
}

describe('Factory run lifecycle audit', () => {
  it('exposes the open runs of the thread the session is on, used by dispatch admission', async () => {
    const { session, openRuns, start } = await setup();
    await start();
    await openRuns.open({ ...OPEN_RUN, kickoffId: 'elsewhere', threadId: 'thread-2' });

    await expect(listSessionOpenRuns(session, openRuns)).resolves.toEqual([
      { ...OPEN_RUN, startedAt: expect.any(Number) },
    ]);
  });

  describe('runs left in the thread setting by a release before the storage ledger', () => {
    it('copies a run whose owner is gone to the ledger, leaving the setting as it is', async () => {
      const { session, settings, openRuns, ledger } = await setup();
      const legacy = [{ ...OPEN_RUN, agentName: 'plan agent' }];
      settings[FACTORY_OPEN_RUNS_SETTING] = legacy;

      await expect(listSessionOpenRuns(session, openRuns)).resolves.toEqual([OPEN_RUN]);
      await expect(ledger()).resolves.toEqual([OPEN_RUN]);
      expect(settings[FACTORY_OPEN_RUNS_SETTING]).toBe(legacy);
      await expect(listSessionOpenRuns(session, openRuns)).resolves.toEqual([OPEN_RUN]);
    });

    it("reads another owner's live run in place, and copies it once it goes stale", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2030-01-01T00:00:00Z'));
      try {
        const { session, settings, openRuns, ledger } = await setup();
        const live = { ...OPEN_RUN, ownerId: 'old-release', heartbeatAt: Date.now() };
        settings[FACTORY_OPEN_RUNS_SETTING] = [live];

        const [entry] = await listSessionOpenRuns(session, openRuns);
        expect(entry).toEqual(live);
        expect(isOpenRunLiveElsewhere(entry!, 'worker-2')).toBe(true);
        await expect(ledger()).resolves.toEqual([]);

        vi.setSystemTime(Date.now() + FACTORY_OPEN_RUN_STALE_MS);
        await expect(listSessionOpenRuns(session, openRuns)).resolves.toEqual([live]);
        await expect(listSessionOpenRuns(session, openRuns)).resolves.toEqual([live]);
        await expect(ledger()).resolves.toEqual([live]);
      } finally {
        vi.useRealTimers();
      }
    });

    it('takes nothing from an entry naming another thread or carrying a heartbeat from the future', async () => {
      const { session, settings, openRuns, ledger } = await setup();
      settings[FACTORY_OPEN_RUNS_SETTING] = [
        { ...OPEN_RUN, kickoffId: 'planted', threadId: 'thread-2', ownerId: 'forged', heartbeatAt: 1 },
        { ...OPEN_RUN, ownerId: 'forged', heartbeatAt: Number.MAX_SAFE_INTEGER },
      ];

      await expect(listSessionOpenRuns(session, openRuns)).resolves.toEqual([]);
      await expect(ledger()).resolves.toEqual([]);
      await expect(openRuns.listByThread('thread-2')).resolves.toEqual([]);
    });

    it('reads a heartbeat a little ahead, as from a replica whose clock runs fast, as now', async () => {
      const { session, settings, openRuns } = await setup();
      const before = Date.now();
      settings[FACTORY_OPEN_RUNS_SETTING] = [{ ...OPEN_RUN, ownerId: 'old-release', heartbeatAt: before + 5_000 }];

      const [entry] = await listSessionOpenRuns(session, openRuns);
      expect(entry!.heartbeatAt).toBeGreaterThanOrEqual(before);
      expect(entry!.heartbeatAt).toBeLessThanOrEqual(Date.now());
    });

    it('ends a copied run like any other', async () => {
      const { session, settings, openRuns, emit, events, ledger } = await setup();
      settings[FACTORY_OPEN_RUNS_SETTING] = [{ ...OPEN_RUN, ownerId: 'old-release', heartbeatAt: 1 }];

      emit('complete');

      await vi.waitFor(async () => expect(await events()).toHaveLength(1));
      await waitForSessionRunAudit(session);
      expect((await events())[0]).toMatchObject({ action: 'factory.run.ended', metadata: { kickoffId: 'kickoff-1' } });
      await expect(ledger()).resolves.toEqual([]);
      await expect(listSessionOpenRuns(session, openRuns)).resolves.toEqual([]);
    });

    it("leaves a live run of an earlier release to its owner when this session's run ends", async () => {
      const { session, settings, emit, events } = await setup();
      settings[FACTORY_OPEN_RUNS_SETTING] = [{ ...OPEN_RUN, ownerId: 'old-release', heartbeatAt: Date.now() }];

      emit('complete');
      await waitForSessionRunAudit(session);

      await expect(events()).resolves.toEqual([]);
    });

    it('does not bring back a copied run that ended when the setting still lists it', async () => {
      const { session, settings, openRuns, ledger } = await setup();
      settings[FACTORY_OPEN_RUNS_SETTING] = [OPEN_RUN];
      await listSessionOpenRuns(session, openRuns);
      await openRuns.end('kickoff-1', { reason: 'complete', endedAt: 1 });
      await openRuns.close(OPEN_RUN, 1);

      await expect(listSessionOpenRuns(session, openRuns)).resolves.toEqual([]);
      await expect(ledger()).resolves.toEqual([]);
    });

    it('keeps a copied run that ended closed when the setting is given a fresh heartbeat for it', async () => {
      const { session, settings, openRuns } = await setup();
      settings[FACTORY_OPEN_RUNS_SETTING] = [OPEN_RUN];
      await listSessionOpenRuns(session, openRuns);
      await openRuns.end('kickoff-1', { reason: 'complete', endedAt: 1 });
      await openRuns.close(OPEN_RUN, 1);

      settings[FACTORY_OPEN_RUNS_SETTING] = [{ ...OPEN_RUN, ownerId: 'forged', heartbeatAt: Date.now() }];

      await expect(listSessionOpenRuns(session, openRuns)).resolves.toEqual([]);
    });

    it('reads a copied run from the ledger alone once its old owner heartbeats in the setting again', async () => {
      const { session, settings, openRuns, emit, events, ledger } = await setup();
      const copied = { ...OPEN_RUN, ownerId: 'old-release', heartbeatAt: 1 };
      settings[FACTORY_OPEN_RUNS_SETTING] = [copied];
      await listSessionOpenRuns(session, openRuns);

      settings[FACTORY_OPEN_RUNS_SETTING] = [{ ...copied, heartbeatAt: Date.now() }];

      await expect(listSessionOpenRuns(session, openRuns)).resolves.toEqual([copied]);
      emit('complete');
      await waitForSessionRunAudit(session);
      expect((await events()).map(event => event.metadata.kickoffId)).toEqual(['kickoff-1']);
      await expect(ledger()).resolves.toEqual([]);
    });

    it('considers only the latest entries of an overlong setting, copying no more than those', async () => {
      const { session, settings, openRuns, ledger } = await setup();
      const entries = Array.from({ length: 1_000 }, (_, index) => ({
        ...OPEN_RUN,
        kickoffId: `kickoff-${index}`,
        heartbeatAt: 1,
      }));
      settings[FACTORY_OPEN_RUNS_SETTING] = entries;
      const importLegacy = vi.spyOn(openRuns, 'importLegacy');

      await listSessionOpenRuns(session, openRuns);

      expect(importLegacy.mock.calls[0]![1]).toHaveLength(FACTORY_LEGACY_OPEN_RUNS_READ);
      expect((await ledger()).map(run => run.kickoffId).sort()).toEqual(
        entries
          .slice(-FACTORY_LEGACY_OPEN_RUNS_READ)
          .map(run => run.kickoffId)
          .sort(),
      );
    });

    it('lists a legacy run once when another reader copies it between the ledger reads', async () => {
      const { session, settings, openRuns } = await setup();
      const live = { ...OPEN_RUN, ownerId: 'old-release', heartbeatAt: Date.now() };
      settings[FACTORY_OPEN_RUNS_SETTING] = [live];
      const list = openRuns.listByThread.bind(openRuns);
      vi.spyOn(openRuns, 'listByThread').mockImplementationOnce(async threadId => {
        await openRuns.open(live);
        return list(threadId);
      });

      await expect(listSessionOpenRuns(session, openRuns)).resolves.toEqual([live]);
    });

    it('still counts entries written before ownership was recorded as stale', async () => {
      const { session, settings, openRuns } = await setup();
      settings[FACTORY_OPEN_RUNS_SETTING] = [OPEN_RUN];

      const [entry] = await listSessionOpenRuns(session, openRuns);
      expect(isOpenRunLiveElsewhere(entry!, 'worker-2')).toBe(false);
    });
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
    const { openRuns, start, events, ledger } = await setup();
    await start({ ...OPEN_RUN, ownerId: 'worker-1', heartbeatAt: 1 });
    await heartbeatSessionOpenRun(openRuns, { kickoffId: 'kickoff-1', ownerId: 'worker-1', at: 2 });
    await heartbeatSessionOpenRun(openRuns, { kickoffId: 'kickoff-1', ownerId: 'someone-else', at: 3 });
    await heartbeatSessionOpenRun(openRuns, { kickoffId: 'someone-else', ownerId: 'worker-1', at: 3 });

    expect(await ledger()).toEqual([
      expect.objectContaining({ kickoffId: 'kickoff-1', ownerId: 'worker-1', heartbeatAt: 2 }),
    ]);
    const [started] = await events();
    expect(started!.metadata).not.toHaveProperty('ownerId');
    expect(started!.metadata).not.toHaveProperty('heartbeatAt');
  });

  it('retains both kickoffs when roles hand off within the same agent turn', async () => {
    const { session, start, emit, events, ledger } = await setup();
    await start({ ...OPEN_RUN, kickoffId: 'plan', role: 'plan' });
    await start({ ...OPEN_RUN, kickoffId: 'work', role: 'work' });
    emit('complete');

    await vi.waitFor(async () => expect(await events()).toHaveLength(4));
    const ended = (await events()).filter(event => event.action === 'factory.run.ended');
    expect(ended.map(event => event.metadata.kickoffId).sort()).toEqual(['plan', 'work']);
    expect(ended.every(event => event.metadata.startedBy === 'approver-2')).toBe(true);
    await waitForSessionRunAudit(session);
    expect(await ledger()).toEqual([]);
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
    const { start, emit, events, ledger } = await setup();
    await start();
    emit('suspended');
    expect(await events()).toHaveLength(1);
    expect(await ledger()).toHaveLength(1);

    emit('error');
    await vi.waitFor(async () => expect(await events()).toHaveLength(2));
    expect((await events()).find(event => event.action === 'factory.run.ended')?.metadata.reason).toBe('error');
  });

  it('dates each run end from its kickoff, so a session timeline can draw the whole run', async () => {
    const { start, emit, events } = await setup();
    const beforeKickoff = Date.now();
    await start();
    emit('complete');

    await vi.waitFor(async () => expect(await events()).toHaveLength(2));
    const ended = (await events()).find(event => event.action === 'factory.run.ended');
    const startedAt = ended?.metadata.startedAt;
    expect(startedAt).toEqual(expect.any(Number));
    expect(startedAt).toBeGreaterThanOrEqual(beforeKickoff);
    expect(startedAt).toBeLessThanOrEqual(ended!.occurredAt.getTime());
  });

  it('records a run that finishes before its delivery acknowledgement', async () => {
    const { start, emit, events } = await setup();
    emit('complete');
    await start(OPEN_RUN, 'complete');
    expect((await events()).map(event => event.action).sort()).toEqual(['factory.run.ended', 'factory.run.started']);
  });

  describe('taking over a lost run', () => {
    const lost = { ...OPEN_RUN, ownerId: 'lost-worker', heartbeatAt: 1 };
    const endedRecords = async (events: () => Promise<Array<{ action: string; metadata: Record<string, unknown> }>>) =>
      (await events())
        .filter(event => event.action === 'factory.run.ended')
        .map(event => [event.metadata.kickoffId, event.metadata.reason]);

    /** Takes `lost` over while another replica writes the ledger between the stale read and the takeover. */
    async function takeOverWhile(during: (openRuns: Awaited<ReturnType<typeof setup>>['openRuns']) => Promise<void>) {
      const context = await setup();
      const { session, openRuns, audit } = context;
      await openRuns.open(lost);
      const takeOver = openRuns.takeOver.bind(openRuns);
      vi.spyOn(openRuns, 'takeOver').mockImplementationOnce(async (...args) => {
        await during(openRuns);
        return takeOver(...args);
      });
      const tookOver = await takeOverInterruptedSessionRuns(session, {
        audit,
        openRuns,
        lost: [lost],
        resumeKickoffId: 'kickoff-1:resume:2',
        ownerId: 'worker-2',
      });
      return { ...context, tookOver };
    }

    it('keeps a run another replica opened meanwhile, and records the lost run as aborted', async () => {
      const opened = {
        ...OPEN_RUN,
        kickoffId: 'kickoff-2',
        bindingId: 'binding-2',
        ownerId: 'worker-3',
        heartbeatAt: 2,
      };

      const { tookOver, ledger, events } = await takeOverWhile(async openRuns => {
        await openRuns.open(opened);
      });

      expect(tookOver).toBe(true);
      const runs = await ledger();
      expect(runs).toHaveLength(2);
      expect(runs).toEqual(
        expect.arrayContaining([
          opened,
          expect.objectContaining({ kickoffId: 'kickoff-1:resume:2', ownerId: 'worker-2' }),
        ]),
      );
      await expect(endedRecords(events)).resolves.toEqual([['kickoff-1', 'aborted']]);
    });

    it('steps aside, recording nothing, when another worker took the lost run over first', async () => {
      const theirs = { ...OPEN_RUN, kickoffId: 'kickoff-1:resume:3', ownerId: 'worker-3', heartbeatAt: 2 };

      const { tookOver, openRuns, events } = await takeOverWhile(async openRuns => {
        await openRuns.takeOver([lost], theirs);
      });

      expect(tookOver).toBe(false);
      await expect(openRuns.get('kickoff-1:resume:2')).resolves.toBeUndefined();
      await expect(openRuns.get(theirs.kickoffId)).resolves.toEqual({ run: theirs });
      await expect(endedRecords(events)).resolves.toEqual([]);
    });

    it('steps aside when the lost run heartbeats again, leaving its real end and usage to its owner', async () => {
      const { tookOver, ledger, events, session, emit, step } = await takeOverWhile(openRuns =>
        heartbeatSessionOpenRun(openRuns, { kickoffId: 'kickoff-1', ownerId: 'lost-worker', at: 5 }),
      );

      expect(tookOver).toBe(false);
      await expect(ledger()).resolves.toEqual([{ ...lost, heartbeatAt: 5 }]);
      await expect(endedRecords(events)).resolves.toEqual([]);

      step(100, 50);
      emit('complete');
      await waitForSessionRunAudit(session);
      const [ended] = (await events()).filter(event => event.action === 'factory.run.ended');
      expect(ended?.metadata).toMatchObject({
        kickoffId: 'kickoff-1',
        reason: 'complete',
        usage: { status: 'recorded', totals: { totalTokens: 150 } },
      });
    });

    it("bills nothing of this session's turn to a lost run whose takeover committed in a worker that then died", async () => {
      const { openRuns, session, events, emit, step } = await setup();
      const resumed = { ...OPEN_RUN, kickoffId: 'kickoff-1:resume:2', ownerId: 'worker-2', heartbeatAt: Date.now() };
      await openRuns.open(lost);
      // The takeover committed (the lost run ended as aborted on its row); its worker died before the audit record.
      await expect(openRuns.takeOver([lost], resumed)).resolves.toBe(true);

      step(100, 50);
      emit('complete');
      await waitForSessionRunAudit(session);

      const ended = Object.fromEntries(
        (await events())
          .filter(event => event.action === 'factory.run.ended')
          .map(event => [event.metadata.kickoffId, event.metadata]),
      );
      expect(ended['kickoff-1']).toMatchObject({ reason: 'aborted', usage: { status: 'unreported' } });
      expect(ended['kickoff-1:resume:2']).toMatchObject({
        reason: 'complete',
        usage: { status: 'recorded', totals: { totalTokens: 150 } },
      });
      expect(ended['kickoff-1:resume:2']?.usage).not.toHaveProperty('sharedWithKickoffIds');
    });

    it('keeps a lost run whose aborted end could not be audited on the ledger, and records it at the next run end', async () => {
      const { session, openRuns, audit, ledger, events, emit } = await setup();
      await openRuns.open(lost);
      vi.spyOn(audit, 'record').mockResolvedValueOnce(null as never);
      const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await expect(
        takeOverInterruptedSessionRuns(session, {
          audit,
          openRuns,
          lost: [lost],
          resumeKickoffId: 'kickoff-1:resume:2',
          ownerId: 'worker-2',
        }),
      ).resolves.toBe(true);
      warning.mockRestore();
      await expect(openRuns.get('kickoff-1')).resolves.toMatchObject({ end: { reason: 'aborted' } });
      expect((await ledger()).map(run => run.kickoffId).sort()).toEqual(['kickoff-1', 'kickoff-1:resume:2']);

      emit('complete');
      await waitForSessionRunAudit(session);
      await expect(endedRecords(events)).resolves.toEqual(
        expect.arrayContaining([
          ['kickoff-1', 'aborted'],
          ['kickoff-1:resume:2', 'complete'],
        ]),
      );
      const [lostEnd] = (await events()).filter(
        event => event.action === 'factory.run.ended' && event.metadata.kickoffId === 'kickoff-1',
      );
      expect(lostEnd?.metadata.usage).toEqual({ status: 'unreported' });
      await expect(ledger()).resolves.toEqual([]);
    });
  });

  it("records how a run ended on the run's own row, before its audit record and before it leaves the ledger", async () => {
    const { session, start, emit, settings, audit, openRuns } = await setup();
    await start();
    const order: string[] = [];
    const end = openRuns.end.bind(openRuns);
    vi.spyOn(openRuns, 'end').mockImplementation(async (kickoffId, ended) => {
      order.push(`end:${kickoffId}`);
      return end(kickoffId, ended);
    });
    const record = audit.record.bind(audit);
    vi.spyOn(audit, 'record').mockImplementation(async input => {
      order.push(input.action);
      return record(input);
    });
    const close = openRuns.close.bind(openRuns);
    vi.spyOn(openRuns, 'close').mockImplementation(async (run, at) => {
      order.push(`close:${run.kickoffId}`);
      await close(run, at);
    });
    const settingsBefore = { ...settings };
    emit('error');
    await waitForSessionRunAudit(session);

    expect(order).toEqual([`end:${OPEN_RUN.kickoffId}`, 'factory.run.ended', `close:${OPEN_RUN.kickoffId}`]);
    await expect(openRuns.get(OPEN_RUN.kickoffId)).resolves.toMatchObject({
      end: { reason: 'error', endedAt: expect.any(Number) },
    });
    // Nothing about the run's end lands in thread metadata, which clients can write.
    expect(settings).toEqual(settingsBefore);
  });

  it('leaves an end recoverable when the audit store is temporarily unavailable', async () => {
    const { start, emit, events, audit, ledger, openRuns } = await setup();
    await start();
    const failure = vi.spyOn(audit, 'record').mockRejectedValueOnce(new Error('store unavailable'));
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    emit('complete');
    await vi.waitFor(() => expect(warning).toHaveBeenCalledOnce());
    expect(await ledger()).toHaveLength(1);
    // A waiter elsewhere still reads the end while the audit store is down.
    await expect(openRuns.get(OPEN_RUN.kickoffId)).resolves.toMatchObject({ end: { reason: 'complete' } });
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
      const { audit, openRuns } = await createFactoryStorageForTests();
      const work = makeSession('thread-work');
      const review = makeSession('thread-review');
      for (const [capture, role] of [
        [work, 'work'],
        [review, 'review'],
      ] as const) {
        observeSessionRunEnd(capture.session, { audit, openRuns });
        await recordSessionRunStart(capture.session, {
          audit,
          openRuns,
          run: { ...OPEN_RUN, kickoffId: `kickoff-${role}`, role, threadId: `thread-${role}` },
          actorType: 'human',
          observedEnd: () => undefined,
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

    it('keeps the usage a run end claimed when recording its end on the ledger fails', async () => {
      const { session, start, emit, step, events, openRuns } = await setup();
      await start();
      step(100, 50);
      const failure = vi.spyOn(openRuns, 'end').mockRejectedValueOnce(new Error('store unavailable'));
      const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
      emit('complete');
      await waitForSessionRunAudit(session);
      failure.mockRestore();
      warning.mockRestore();

      emit('complete');
      await vi.waitFor(async () => expect(await ended(events)).toHaveLength(1));
      expect((await ended(events))[0]?.usage).toMatchObject({ status: 'recorded', totals: { totalTokens: 150 } });
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
      const { session, start, emit, step, events, audit, ledger } = await setup();
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
      expect(await ledger()).toHaveLength(1);
      failure.mockRestore();
      warning.mockRestore();

      emit('complete');
      await vi.waitFor(async () => expect(await ended(events)).toHaveLength(1));
      expect((await ended(events))[0]?.usage).toMatchObject({ status: 'recorded', totals: { totalTokens: 150 } });
      await waitForSessionRunAudit(session);
      expect(await ledger()).toEqual([]);
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
