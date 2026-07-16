import { beforeEach, describe, expect, it, vi } from 'vitest';

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
    expect(goal).toMatchObject({ objective: 'finish the task', status: 'active', turnsUsed: 0, maxTurns: 25 });
    expect(manager.isActive()).toBe(true);
  });

  it('falls back to a local record when no agent or thread is available', async () => {
    const state = createState(undefined, undefined);
    const manager = new GoalManager();

    const goal = await manager.setGoal(state, 'offline goal', '__GATEWAY_OPENAI_MODEL__', DEFAULT_MAX_TURNS);

    expect(goal).toMatchObject({ objective: 'offline goal', status: 'active', maxTurns: DEFAULT_MAX_TURNS });
  });

  it('pauses and resumes without losing turn count or active duration', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-15T10:00:00.000Z'));
    const manager = new GoalManager();
    await manager.setGoal(createState(createAgent()), 'finish the task', '__GATEWAY_OPENAI_MODEL__');
    manager.applyEvaluation({ runsUsed: 3, status: 'active' });

    vi.setSystemTime(new Date('2026-05-15T10:05:00.000Z'));
    manager.pause();
    expect(manager.getGoal()).toMatchObject({ status: 'paused', turnsUsed: 3 });

    vi.setSystemTime(new Date('2026-05-15T12:00:00.000Z'));
    manager.resume();
    vi.setSystemTime(new Date('2026-05-15T12:02:00.000Z'));
    manager.stopActiveTimer();

    expect(manager.getGoal()).toMatchObject({ status: 'active', turnsUsed: 3, activeDurationMs: 7 * 60_000 });
    vi.useRealTimers();
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

  it('syncs the first objective created through the Agent API', async () => {
    const agent = createAgent();
    agent.getObjective.mockResolvedValue(makeRecord({ id: 'external-1', objective: 'external goal', runsUsed: 2 }));
    const manager = new GoalManager();

    const result = await manager.syncFromThread(createState(agent));

    expect(result).toMatchObject({ status: 'synced', replaced: true });
    expect(manager.getGoal()).toMatchObject({ id: 'external-1', objective: 'external goal', turnsUsed: 2 });
  });

  it('merges the same durable objective without resetting timers or persistence flags', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-15T10:00:00.000Z'));
    const agent = createAgent();
    agent.getObjective.mockResolvedValue(makeRecord({ id: 'external-1', objective: 'external goal' }));
    const manager = new GoalManager();
    await manager.syncFromThread(createState(agent));
    const startedAt = manager.getGoal()?.activeStartedAt;
    manager.persistOnNextThreadCreate();

    vi.setSystemTime(new Date('2026-05-15T10:05:00.000Z'));
    agent.getObjective.mockResolvedValue(
      makeRecord({ id: 'external-1', objective: 'external goal', runsUsed: 3, maxRuns: 25 }),
    );
    const result = await manager.syncFromThread(createState(agent));

    expect(result).toMatchObject({ status: 'synced', replaced: false });
    expect(manager.getGoal()).toMatchObject({ turnsUsed: 3, maxTurns: 25, activeStartedAt: startedAt });
    expect(manager.consumePersistOnNextThreadCreate()).toBe(true);
    vi.useRealTimers();
  });

  it('treats a different durable ID with the same objective as a replacement exactly once', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-15T10:00:00.000Z'));
    const agent = createAgent();
    const manager = new GoalManager();
    agent.getObjective.mockResolvedValue(makeRecord({ id: 'external-1', objective: 'same text' }));
    await manager.syncFromThread(createState(agent));

    vi.setSystemTime(new Date('2026-05-15T10:05:00.000Z'));
    agent.getObjective.mockResolvedValue(makeRecord({ id: 'external-2', objective: 'same text' }));
    const replaced = await manager.syncFromThread(createState(agent));
    const replacedStartedAt = manager.getGoal()?.activeStartedAt;

    vi.setSystemTime(new Date('2026-05-15T10:10:00.000Z'));
    const repeated = await manager.syncFromThread(createState(agent));

    expect(replaced).toMatchObject({ status: 'synced', replaced: true });
    expect(repeated).toMatchObject({ status: 'synced', replaced: false });
    expect(manager.getGoal()).toMatchObject({
      id: 'external-2',
      objective: 'same text',
      activeStartedAt: replacedStartedAt,
    });
    expect(replacedStartedAt).toBe('2026-05-15T10:05:00.000Z');
    vi.useRealTimers();
  });

  it('replaces the mirror when the durable objective text changes', async () => {
    const agent = createAgent();
    const manager = new GoalManager();
    agent.getObjective.mockResolvedValue(makeRecord({ id: 'external-1', objective: 'first goal' }));
    await manager.syncFromThread(createState(agent));
    agent.getObjective.mockResolvedValue(makeRecord({ id: 'external-2', objective: 'second goal', status: 'paused' }));

    const result = await manager.syncFromThread(createState(agent));

    expect(result).toMatchObject({ status: 'synced', replaced: true });
    expect(manager.getGoal()).toMatchObject({ id: 'external-2', objective: 'second goal', status: 'paused' });
    expect(manager.getGoal()?.activeStartedAt).toBeUndefined();
  });

  it('leaves the current mirror untouched when no durable objective exists', async () => {
    const agent = createAgent();
    const manager = new GoalManager();
    await manager.setGoal(createState(agent), 'rendering goal', '__GATEWAY_OPENAI_MODEL__');
    const before = manager.getGoal();
    agent.getObjective.mockResolvedValue(undefined);

    const result = await manager.syncFromThread(createState(agent));

    expect(result).toEqual({ status: 'no-record' });
    expect(manager.getGoal()).toEqual(before);
  });

  it('returns a typed read error without changing the mirror or timers', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-15T10:00:00.000Z'));
    const agent = createAgent();
    const manager = new GoalManager();
    await manager.setGoal(createState(agent), 'rendering goal', '__GATEWAY_OPENAI_MODEL__');
    manager.persistOnNextThreadCreate();
    const before = manager.getGoal();
    const failure = new Error('storage unavailable');
    agent.getObjective.mockRejectedValue(failure);

    const result = await manager.syncFromThread(createState(agent));

    expect(result).toEqual({ status: 'read-error', error: failure });
    expect(manager.getGoal()).toEqual(before);
    expect(manager.consumePersistOnNextThreadCreate()).toBe(true);
    vi.useRealTimers();
  });

  it('loads an objective from ThreadState via the agent', async () => {
    const agent = createAgent();
    agent.getObjective.mockResolvedValue(makeRecord({ objective: 'persisted goal', runsUsed: 4, status: 'paused' }));
    const state = createState(agent);
    const manager = new GoalManager();

    await manager.loadFromThread(state);

    expect(agent.getObjective).toHaveBeenCalledWith({ threadId: 'parent-thread' });
    expect(manager.getGoal()).toMatchObject({ objective: 'persisted goal', turnsUsed: 4, status: 'paused' });
  });

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
      activeStartedAt: undefined,
    });
    vi.useRealTimers();
  });

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

  it('saveToThread updates the record and clears legacy metadata', async () => {
    const agent = createAgent();
    const state = createState(agent);
    const manager = new GoalManager();
    await manager.setGoal(state, 'finish the task', '__GATEWAY_OPENAI_MODEL__');
    manager.pause('Judge evaluation was interrupted.');

    await manager.saveToThread(state);

    expect(agent.updateObjectiveOptions).toHaveBeenCalledWith(
      expect.objectContaining({
        threadId: 'parent-thread',
        status: 'paused',
        pausedReason: 'Judge evaluation was interrupted.',
      }),
    );
    expect(state.session.thread.setSetting).toHaveBeenCalledWith({ key: 'goal', value: undefined });
  });
});
