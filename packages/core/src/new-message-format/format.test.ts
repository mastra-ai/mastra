import { describe, expect, it } from 'vitest';
import { InMemoryDB } from '../storage/domains/inmemory-db';
import { InMemoryMemory } from '../storage/domains/memory/inmemory';
import { InMemoryActionStorage } from './storage';
import { toModelMessages } from './to-model-messages';
import type { PersistableAction } from './types';
import { createUlid } from './ulid';

const id = createUlid();
const base = () => ({ id: id(), threadId: 't1', runId: 'r1', createdAt: new Date('2026-10-15T10:00:00.000Z') });

/** One of each action added in this format version. */
const threadEvents = (): PersistableAction[] => [
  { ...base(), type: 'run-start', agentId: 'a1', modelId: 'm', settings: { modeId: 'build', maxSteps: 5 } },
  { ...base(), type: 'tool-started', toolCallId: 'c1', toolName: 'weather' },
  { ...base(), type: 'goal-started', goalId: 'g1', objective: 'Ship it', options: { maxRuns: 10, judgeModelId: 'j' } },
  {
    ...base(),
    type: 'goal-changed',
    goalId: 'g1',
    status: 'paused',
    pausedReason: 'budget',
    changedBy: { kind: 'user' },
  },
  {
    ...base(),
    type: 'goal-evaluated',
    goalId: 'g1',
    iteration: 1,
    maxRuns: 10,
    outcome: 'completed',
    status: 'done',
    reason: 'All tests pass',
  },
  { ...base(), type: 'goal-ended', goalId: 'g1', reason: 'completed' },
  {
    ...base(),
    type: 'settings-changed',
    setting: 'thinking-level',
    value: 'high',
    previousValue: 'low',
    changedBy: { kind: 'user' },
  },
  {
    ...base(),
    type: 'task-changed',
    tasks: [{ id: 'x', content: 'Do x', status: 'in_progress', activeForm: 'Doing x' }],
    changedBy: { kind: 'agent' },
  },
  { ...base(), type: 'run-end', finishReason: 'interrupted', usage: {} },
];

/**
 * goal-changed and goal-evaluated shapes whose meaning depends on fields staying exactly as written:
 * an options-only edit, a full replacement that drops an option, a resume that clears the pause
 * reason, and a waiting verdict at the budget (which must not become budget-exhausted).
 */
const goalLifecycle = (): PersistableAction[] => [
  { ...base(), type: 'goal-started', goalId: 'g2', objective: 'Ship', options: { maxRuns: 2, prompt: 'be brief' } },
  {
    ...base(),
    type: 'goal-changed',
    goalId: 'g2',
    options: { maxRuns: 3, prompt: 'be brief' },
    changedBy: { kind: 'user' },
  },
  { ...base(), type: 'goal-changed', goalId: 'g2', options: { maxRuns: 3 }, changedBy: { kind: 'user' } },
  {
    ...base(),
    type: 'goal-changed',
    goalId: 'g2',
    status: 'paused',
    pausedReason: 'user paused',
    changedBy: { kind: 'user' },
  },
  { ...base(), type: 'goal-changed', goalId: 'g2', status: 'active', changedBy: { kind: 'user' } },
  {
    ...base(),
    type: 'goal-evaluated',
    goalId: 'g2',
    outcome: 'waiting-for-user',
    iteration: 3,
    maxRuns: 3,
    status: 'active',
    reason: 'Needs the deploy target',
  },
];

describe('action format', () => {
  it('keeps thread events out of the prompt', () => {
    const prompt = toModelMessages([{ ...base(), type: 'text', role: 'user', text: 'hello' }, ...threadEvents()]);
    expect(prompt).toEqual([{ role: 'user', content: [{ type: 'text', text: 'hello' }] }]);
  });

  it('skips row types that are not model content', () => {
    const user = { ...base(), type: 'text', role: 'user', text: 'hello' } as PersistableAction;
    const custom = { ...base(), type: 'data-progress', data: {} } as unknown as PersistableAction;
    expect(toModelMessages([user, custom])).toEqual([{ role: 'user', content: [{ type: 'text', text: 'hello' }] }]);
  });

  describe.each([
    ['InMemoryActionStorage', () => new InMemoryActionStorage()],
    ['InMemoryMemory', () => new InMemoryMemory({ db: new InMemoryDB() })],
  ])('%s', (_name, create) => {
    it('round-trips thread events', async () => {
      const store = create();
      const actions = threadEvents();
      await store.saveActions({ actions });

      const listed = await store.listActions({ threadId: 't1' });
      expect(listed).toEqual(actions);
    });

    it('stores goal changes and verdicts exactly as written, with no merging or defaults', async () => {
      const store = create();
      const actions = goalLifecycle();
      await store.saveActions({ actions });

      const listed = await store.listActions({ threadId: 't1' });
      expect(listed).toEqual(actions);
      const [, edit, replacement, , resume, verdict] = listed;
      expect(edit).not.toHaveProperty('status');
      expect(edit).not.toHaveProperty('pausedReason');
      expect(replacement).toMatchObject({ options: { maxRuns: 3 } });
      expect((replacement as { options: object }).options).not.toHaveProperty('prompt');
      expect(resume).not.toHaveProperty('pausedReason');
      expect(resume).not.toHaveProperty('options');
      expect(verdict).toMatchObject({ outcome: 'waiting-for-user', iteration: 3, maxRuns: 3, status: 'active' });
      expect(verdict).not.toHaveProperty('pausedReason');
    });
  });
});
