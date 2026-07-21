import { describe, expect, it, vi } from 'vitest';

import type { IMastraLogger } from '../../logger';
import { Mastra } from '../../mastra';
import type { GoalObjectiveRecord, ThreadStateStorage } from '../../storage/domains/thread-state/base';
import { InMemoryStore } from '../../storage/mock';
import { beginGoalActivity, getGoalActivityDurationMs, stopGoalActivity } from './activity';
import { GOAL_STATE_TYPE } from './objective';

const agentId = 'activity-agent';

function objective(overrides: Partial<GoalObjectiveRecord> = {}): GoalObjectiveRecord {
  return {
    id: 'objective-1',
    objective: 'Ship the feature',
    status: 'active',
    runsUsed: 0,
    activeDurationMs: 1_000,
    startedAt: 0,
    updatedAt: 0,
    ...overrides,
  };
}

function createLogger() {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    trackException: vi.fn(),
    getTransports: vi.fn().mockReturnValue(new Map()),
    listLogs: vi.fn().mockResolvedValue({ logs: [], total: 0, page: 1, perPage: 10, hasMore: false }),
    listLogsByRunId: vi.fn().mockResolvedValue({ logs: [], total: 0, page: 1, perPage: 10, hasMore: false }),
  } satisfies IMastraLogger;
}

async function setup(record: GoalObjectiveRecord = objective(), logger: IMastraLogger | false = false) {
  const storage = new InMemoryStore();
  const mastra = new Mastra({ storage, logger });
  const store: ThreadStateStorage | undefined = await storage.getStore('threadState');
  const threadId = `thread-${crypto.randomUUID()}`;
  await store!.setState({ threadId, type: GOAL_STATE_TYPE, value: record });
  return { mastra, store: store!, threadId };
}

async function readDuration(store: ThreadStateStorage | undefined, threadId: string) {
  const state = await store!.getState<GoalObjectiveRecord>({ threadId, type: GOAL_STATE_TYPE });
  return state?.activeDurationMs;
}

describe('goal activity tracking', () => {
  it('checkpoints execution time and exposes it to display consumers with a stale record', async () => {
    const { mastra, store, threadId } = await setup();
    let now = 10_000;

    await beginGoalActivity({ mastra, agentId, threadId, runId: 'run-1', now: () => now });
    now += 500;
    expect(
      getGoalActivityDurationMs({
        agentId,
        threadId,
        objectiveId: 'objective-1',
        activeDurationMs: 1_000,
        now: () => now,
      }),
    ).toBe(1_500);

    now += 200;
    await stopGoalActivity({ agentId, runId: 'run-1', now: () => now });

    expect(await readDuration(store, threadId)).toBe(1_700);
    expect(
      getGoalActivityDurationMs({
        agentId,
        threadId,
        objectiveId: 'objective-1',
        activeDurationMs: 1_000,
        now: () => now + 10_000,
      }),
    ).toBe(1_700);
  });

  it('excludes repeated approval waits while counting each resumed segment', async () => {
    const { mastra, store, threadId } = await setup(objective({ activeDurationMs: 0 }));
    let now = 0;

    await beginGoalActivity({ mastra, agentId, threadId, runId: 'approval-run', now: () => now });
    now = 100;
    await stopGoalActivity({ agentId, runId: 'approval-run', now: () => now });

    now = 10_000;
    expect(await readDuration(store, threadId)).toBe(100);

    await beginGoalActivity({ mastra, agentId, threadId, runId: 'approval-run', now: () => now });
    now = 10_050;
    await stopGoalActivity({ agentId, runId: 'approval-run', now: () => now });

    now = 20_000;
    await beginGoalActivity({ mastra, agentId, threadId, runId: 'approval-run', now: () => now });
    now = 20_025;
    await stopGoalActivity({ agentId, runId: 'approval-run', now: () => now });

    expect(await readDuration(store, threadId)).toBe(175);
  });

  it('serializes concurrent segment checkpoints for the same objective', async () => {
    const { mastra, store, threadId } = await setup(objective({ activeDurationMs: 0 }));

    await Promise.all([
      beginGoalActivity({ mastra, agentId, threadId, runId: 'run-a', now: () => 0 }),
      beginGoalActivity({ mastra, agentId, threadId, runId: 'run-b', now: () => 0 }),
    ]);
    await Promise.all([
      stopGoalActivity({ agentId, runId: 'run-a', now: () => 100 }),
      stopGoalActivity({ agentId, runId: 'run-b', now: () => 250 }),
    ]);

    expect(await readDuration(store, threadId)).toBe(350);
  });

  it('does not attach elapsed time to a replacement objective', async () => {
    const { mastra, store, threadId } = await setup(objective({ activeDurationMs: 0 }));

    await beginGoalActivity({ mastra, agentId, threadId, runId: 'replaced-run', now: () => 0 });
    await store.setState({
      threadId,
      type: GOAL_STATE_TYPE,
      value: objective({ id: 'objective-2', objective: 'A different goal', activeDurationMs: 50 }),
    });
    expect(
      getGoalActivityDurationMs({
        agentId,
        threadId,
        objectiveId: 'objective-2',
        activeDurationMs: 50,
        now: () => 1_000,
      }),
    ).toBe(50);
    await stopGoalActivity({ agentId, runId: 'replaced-run', now: () => 1_000 });

    expect(await readDuration(store, threadId)).toBe(50);
  });

  it('logs and ignores failures while reading the objective at activity start', async () => {
    const logger = createLogger();
    const { mastra, store, threadId } = await setup(objective(), logger);
    const error = new Error('objective read failed');
    vi.spyOn(store, 'getState').mockRejectedValueOnce(error);

    await expect(beginGoalActivity({ mastra, agentId, threadId, runId: 'failed-start' })).resolves.toBeUndefined();

    expect(logger.debug).toHaveBeenCalledWith('Failed to begin goal activity tracking', {
      error,
      agentId,
      threadId,
      runId: 'failed-start',
    });
  });

  it('logs and ignores failures while checkpointing activity', async () => {
    const logger = createLogger();
    const { mastra, store, threadId } = await setup(objective({ activeDurationMs: 0 }), logger);
    const error = new Error('write failed');

    await beginGoalActivity({ mastra, agentId, threadId, runId: 'failed-checkpoint', now: () => 0 });
    vi.spyOn(store, 'setState').mockRejectedValueOnce(error);

    await expect(stopGoalActivity({ agentId, runId: 'failed-checkpoint', now: () => 100 })).resolves.toBeUndefined();

    expect(logger.debug).toHaveBeenCalledWith('Failed to persist goal activity duration', {
      error,
      agentId,
      threadId,
      runId: 'failed-checkpoint',
    });
  });

  it('does not fail activity handling when the logger throws', async () => {
    const logger = createLogger();
    logger.debug.mockImplementation(() => {
      throw new Error('logger failed');
    });
    const { mastra, store, threadId } = await setup(objective(), logger);
    vi.spyOn(store, 'getState').mockRejectedValueOnce(new Error('objective read failed'));

    await expect(beginGoalActivity({ mastra, agentId, threadId, runId: 'failed-logger' })).resolves.toBeUndefined();
  });

  it('does not start activity for a paused objective', async () => {
    const { mastra, store, threadId } = await setup(objective({ status: 'paused', activeDurationMs: 20 }));

    await beginGoalActivity({ mastra, agentId, threadId, runId: 'paused-run', now: () => 0 });
    await stopGoalActivity({ agentId, runId: 'paused-run', now: () => 1_000 });

    expect(await readDuration(store, threadId)).toBe(20);
  });
});
