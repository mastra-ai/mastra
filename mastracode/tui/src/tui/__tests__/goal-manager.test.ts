import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  loadSettings: vi.fn(() => ({ models: { goalJudgeModel: '__GATEWAY_OPENAI_MODEL__', goalMaxTurns: 50 } })),
}));

vi.mock('@mastra/code-sdk/onboarding/settings', () => ({
  loadSettings: mocks.loadSettings,
}));

import { GoalManager, DEFAULT_MAX_TURNS } from '../goal-manager.js';
import type { TUIState } from '../state.js';

interface FakeAgent {
  setObjective: ReturnType<typeof vi.fn>;
  getObjective: ReturnType<typeof vi.fn>;
  clearObjective: ReturnType<typeof vi.fn>;
  updateObjectiveOptions: ReturnType<typeof vi.fn>;
}

function makeRecord(overrides: Record<string, unknown> = {}) {
  const now = Date.now();
  return {
    objective: 'finish the task',
    status: 'active',
    runsUsed: 0,
    activeDurationMs: 0,
    maxRuns: 50,
    judgeModelId: '__GATEWAY_OPENAI_MODEL__',
    startedAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function createState(agent?: FakeAgent, threadId: string | undefined = 'parent-thread'): TUIState {
  return {
    session: {
      identity: { getResourceId: vi.fn(() => 'resource-1') },
      thread: { getId: vi.fn(() => threadId), setSetting: vi.fn().mockResolvedValue(undefined) },
    },
    controller: {
      getCurrentAgent: vi.fn(() => agent),
    },
  } as unknown as TUIState;
}

function createAgent(): FakeAgent {
  return {
    setObjective: vi.fn(async (objective: string, opts: Record<string, unknown>) =>
      makeRecord({ objective, ...opts, maxRuns: opts.maxRuns ?? 50 }),
    ),
    getObjective: vi.fn(async () => undefined),
    clearObjective: vi.fn(async () => undefined),
    updateObjectiveOptions: vi.fn(async (opts: Record<string, unknown>) => makeRecord({ ...opts })),
  };
}

describe('GoalManager adapter', () => {
  beforeEach(() => {
    mocks.loadSettings.mockReturnValue({ models: { goalJudgeModel: '__GATEWAY_OPENAI_MODEL__', goalMaxTurns: 50 } });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('sets an objective via the agent and exposes a GoalState view', async () => {
    const agent = createAgent();
    const state = createState(agent);
    const manager = new GoalManager();

    const goal = await manager.setGoal(state, 'finish the task', '__GATEWAY_OPENAI_MODEL__', 25);

    expect(agent.setObjective).toHaveBeenCalledWith(
      'finish the task',
      expect.objectContaining({
        threadId: 'parent-thread',
        resourceId: 'resource-1',
        judgeModelId: '__GATEWAY_OPENAI_MODEL__',
        maxRuns: 25,
      }),
    );
    expect(agent.setObjective.mock.calls[0]?.[1]).not.toHaveProperty('activeDurationMs');
    expect(goal).toMatchObject({ objective: 'finish the task', status: 'active', turnsUsed: 0, maxTurns: 25 });
    expect(manager.isActive()).toBe(true);
  });

  it('falls back to a local record when no agent or thread is available', async () => {
    const state = createState(undefined, undefined);
    const manager = new GoalManager();

    const goal = await manager.setGoal(state, 'offline goal', '__GATEWAY_OPENAI_MODEL__', DEFAULT_MAX_TURNS);

    expect(goal).toMatchObject({ objective: 'offline goal', status: 'active', maxTurns: DEFAULT_MAX_TURNS });
  });

  it('pauses and resumes without mutating core-owned active duration', async () => {
    const agent = createAgent();
    agent.setObjective.mockResolvedValue(makeRecord({ activeDurationMs: 7 * 60_000 }));
    const manager = new GoalManager();
    await manager.setGoal(createState(agent), 'finish the task', '__GATEWAY_OPENAI_MODEL__');
    manager.applyEvaluation({ runsUsed: 3, status: 'active' });

    manager.pause();
    expect(manager.getGoal()).toMatchObject({ status: 'paused', turnsUsed: 3, activeDurationMs: 7 * 60_000 });

    manager.resume();
    expect(manager.getGoal()).toMatchObject({ status: 'active', turnsUsed: 3, activeDurationMs: 7 * 60_000 });
  });

  it('updates judge defaults on the active goal, persisting via the agent', async () => {
    const agent = createAgent();
    agent.updateObjectiveOptions.mockResolvedValue(
      makeRecord({ judgeModelId: 'anthropic/claude-sonnet-4-5', maxRuns: 25, runsUsed: 3 }),
    );
    const state = createState(agent);
    const manager = new GoalManager();
    await manager.setGoal(state, 'finish the task', '__GATEWAY_OPENAI_MODEL__', 50);

    const goal = await manager.updateJudgeDefaults(state, 'anthropic/claude-sonnet-4-5', 25);

    expect(agent.updateObjectiveOptions).toHaveBeenCalledWith(
      expect.objectContaining({ threadId: 'parent-thread', judgeModelId: 'anthropic/claude-sonnet-4-5', maxRuns: 25 }),
    );
    expect(goal).toMatchObject({ judgeModelId: 'anthropic/claude-sonnet-4-5', maxTurns: 25, turnsUsed: 3 });
  });

  it('applies in-loop evaluations (runsUsed + status) from the goal chunk', async () => {
    const manager = new GoalManager();
    await manager.setGoal(createState(createAgent()), 'finish the task', '__GATEWAY_OPENAI_MODEL__');

    manager.applyEvaluation({ runsUsed: 2, status: 'active' });
    expect(manager.getGoal()).toMatchObject({ turnsUsed: 2, status: 'active' });

    manager.applyEvaluation({ runsUsed: 3, status: 'done' });
    expect(manager.getGoal()).toMatchObject({ turnsUsed: 3, status: 'done' });
    expect(manager.isActive()).toBe(false);
  });

  it('clears the goal', async () => {
    const manager = new GoalManager();
    await manager.setGoal(createState(createAgent()), 'finish the task', '__GATEWAY_OPENAI_MODEL__');
    manager.clear();
    expect(manager.getGoal()).toBeNull();
    expect(manager.isActive()).toBe(false);
  });

  it('loads accumulated duration from ThreadState without restoring a live timer', async () => {
    const agent = createAgent();
    agent.getObjective.mockResolvedValue(
      makeRecord({ objective: 'persisted goal', runsUsed: 4, status: 'paused', activeDurationMs: 60_000 }),
    );
    const state = createState(agent);
    const manager = new GoalManager();

    await manager.loadFromThread(state);

    expect(agent.getObjective).toHaveBeenCalledWith({ threadId: 'parent-thread' });
    expect(manager.getGoal()).toMatchObject({
      objective: 'persisted goal',
      turnsUsed: 4,
      status: 'paused',
      activeDurationMs: 60_000,
    });
    expect(agent.setObjective).not.toHaveBeenCalled();
    expect(agent.updateObjectiveOptions).not.toHaveBeenCalled();
  });

  it('loads an old record without active duration as zero without writing', async () => {
    const agent = createAgent();
    const oldRecord = makeRecord();
    Reflect.deleteProperty(oldRecord, 'activeDurationMs');
    agent.getObjective.mockResolvedValue(oldRecord);
    const manager = new GoalManager();

    await manager.loadFromThread(createState(agent));

    expect(manager.getGoal()).toMatchObject({ activeDurationMs: 0 });
    expect(agent.setObjective).not.toHaveBeenCalled();
    expect(agent.updateObjectiveOptions).not.toHaveBeenCalled();
  });

  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY])(
    'loads malformed active duration %s as zero without writing',
    async activeDurationMs => {
      const agent = createAgent();
      agent.getObjective.mockResolvedValue(makeRecord({ activeDurationMs }));
      const manager = new GoalManager();

      await manager.loadFromThread(createState(agent));

      expect(manager.getGoal()).toMatchObject({ activeDurationMs: 0 });
      expect(agent.setObjective).not.toHaveBeenCalled();
      expect(agent.updateObjectiveOptions).not.toHaveBeenCalled();
    },
  );

  it('clears the in-memory goal when ThreadState has no objective', async () => {
    const agent = createAgent();
    agent.getObjective.mockResolvedValue(undefined);
    const manager = new GoalManager();

    await manager.loadFromThread(createState(agent));

    expect(manager.getGoal()).toBeNull();
  });

  it('hydrates from legacy thread metadata and stops a persisted active timer', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-15T15:00:00.000Z'));
    const manager = new GoalManager();

    manager.loadFromThreadMetadata({
      goal: {
        id: 'goal-1',
        objective: 'finish the task',
        status: 'active',
        turnsUsed: 1,
        maxTurns: 20,
        judgeModelId: '__GATEWAY_OPENAI_MODEL__',
        startedAt: '2026-05-15T10:00:00.000Z',
        activeStartedAt: '2026-05-15T10:00:00.000Z',
        activeDurationMs: 10 * 60_000,
      },
    });

    expect(manager.getGoal()).toMatchObject({
      objective: 'finish the task',
      turnsUsed: 1,
      maxTurns: 20,
      activeDurationMs: 10 * 60_000,
    });
    vi.useRealTimers();
  });

  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY])(
    'normalizes malformed legacy active duration %s to zero',
    activeDurationMs => {
      const manager = new GoalManager();

      manager.loadFromThreadMetadata({
        goal: {
          objective: 'finish the task',
          status: 'active',
          activeDurationMs,
        },
      });

      expect(manager.getGoal()).toMatchObject({ activeDurationMs: 0 });
    },
  );

  it('fills judge model and max runs from settings when the record omits them', async () => {
    mocks.loadSettings.mockReturnValue({ models: { goalJudgeModel: 'anthropic/claude-sonnet-4-5', goalMaxTurns: 33 } });
    const agent = createAgent();
    agent.setObjective.mockResolvedValue(makeRecord({ judgeModelId: undefined, maxRuns: undefined }));
    const manager = new GoalManager();

    const goal = await manager.setGoal(createState(agent), 'finish the task', '', DEFAULT_MAX_TURNS);

    expect(goal).toMatchObject({ judgeModelId: 'anthropic/claude-sonnet-4-5', maxTurns: 33 });
  });

  it('persists the active goal on the next thread create', () => {
    const manager = new GoalManager();
    expect(manager.consumePersistOnNextThreadCreate()).toBe(false);
    manager.persistOnNextThreadCreate();
    expect(manager.consumePersistOnNextThreadCreate()).toBe(true);
    expect(manager.consumePersistOnNextThreadCreate()).toBe(false);
  });

  it('saveToThread preserves core-owned duration when updating status', async () => {
    const agent = createAgent();
    const state = createState(agent);
    const manager = new GoalManager();
    await manager.setGoal(state, 'finish the task', '__GATEWAY_OPENAI_MODEL__');
    manager.pause('Judge evaluation was interrupted.');

    await manager.saveToThread(state);

    expect(agent.updateObjectiveOptions).toHaveBeenCalledWith({
      threadId: 'parent-thread',
      status: 'paused',
      pausedReason: 'Judge evaluation was interrupted.',
      judgeModelId: '__GATEWAY_OPENAI_MODEL__',
      maxRuns: 50,
    });
    expect(state.session.thread.setSetting).toHaveBeenCalledWith({ key: 'goal', value: undefined });
  });

  it('saveToThread carries the record duration through the create fallback', async () => {
    const agent = createAgent();
    agent.setObjective.mockResolvedValue(makeRecord({ activeDurationMs: 2 * 60_000 }));
    const state = createState(agent);
    const manager = new GoalManager();
    await manager.setGoal(state, 'finish the task', '__GATEWAY_OPENAI_MODEL__');
    agent.setObjective.mockClear();
    agent.updateObjectiveOptions.mockResolvedValueOnce(undefined);

    await manager.saveToThread(state);

    expect(agent.setObjective).toHaveBeenCalledWith(
      'finish the task',
      expect.objectContaining({
        threadId: 'parent-thread',
        activeDurationMs: 2 * 60_000,
      }),
    );
  });
});
