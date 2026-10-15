import { describe, expect, it } from 'vitest';
import { InMemoryDB } from '../storage/domains/inmemory-db';
import { InMemoryMemory } from '../storage/domains/memory/inmemory';
import { InMemoryActionStorage } from './storage';
import { toModelMessages } from './to-model-messages';
import type { PersistableAction } from './types';
import {
  ACTION_FORMAT_VERSION,
  UnsupportedActionError,
  isIgnorableActionType,
  isReadableAction,
  toStoredAction,
} from './types';
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
  it('stamps the format version and marks only non-prompt types ignorable', () => {
    const userText = toStoredAction({ ...base(), type: 'text', role: 'user', text: 'hi' });
    expect(userText).toMatchObject({ formatVersion: ACTION_FORMAT_VERSION });
    expect(userText).not.toHaveProperty('ignorable');

    const stored = threadEvents().map(toStoredAction);
    expect(stored.filter(a => !a.ignorable).map(a => a.type)).toEqual(['goal-evaluated']);
    for (const type of ['background-tool-result', 'background-tool-error'] as const) {
      expect(isIgnorableActionType(type)).toBe(false);
    }
    expect(toStoredAction({ ...base(), type: 'data-progress', role: 'assistant', data: 1 }).ignorable).toBe(true);
    expect(toStoredAction({ ...base(), type: 'text', role: 'user', text: 'x', formatVersion: 7 }).formatVersion).toBe(
      7,
    );
  });

  it('toStoredAction adds only the format fields to goal changes and verdicts', () => {
    for (const action of goalLifecycle()) {
      const { formatVersion, ignorable, ...rest } = toStoredAction(action);
      expect(rest).toEqual(action);
      expect(formatVersion).toBe(ACTION_FORMAT_VERSION);
      expect(ignorable).toBe(action.type === 'goal-evaluated' ? undefined : true);
    }
  });

  it('keeps thread events out of the prompt', () => {
    const prompt = toModelMessages([{ ...base(), type: 'text', role: 'user', text: 'hello' }, ...threadEvents()]);
    expect(prompt).toEqual([{ role: 'user', content: [{ type: 'text', text: 'hello' }] }]);
  });

  it('skips unknown ignorable rows and refuses unknown required ones', () => {
    const user = { ...base(), type: 'text', role: 'user', text: 'hello' } as PersistableAction;
    const futureSkippable = {
      ...base(),
      type: 'usage',
      ignorable: true,
      formatVersion: 2,
    } as unknown as PersistableAction;
    expect(toModelMessages([user, futureSkippable])).toEqual([
      { role: 'user', content: [{ type: 'text', text: 'hello' }] },
    ]);

    const futureRequired = { ...base(), type: 'retract', formatVersion: 2 } as unknown as PersistableAction;
    expect(() => toModelMessages([user, futureRequired])).toThrow(UnsupportedActionError);
    expect(() => toModelMessages([user, futureRequired])).toThrow(/"retract" \(format version 2/);
  });

  it('refuses a known type from a newer format version unless it is ignorable', () => {
    const user = { ...base(), type: 'text', role: 'user', text: 'hello' } as PersistableAction;
    const newer = { ...base(), type: 'text', role: 'user', text: 'v2 text', formatVersion: 2 } as PersistableAction;
    expect(() => toModelMessages([user, newer])).toThrow(UnsupportedActionError);
    expect(() => toModelMessages([user, newer])).toThrow(/"text" \(format version 2/);
    expect(toModelMessages([user, { ...newer, ignorable: true }])).toEqual([
      { role: 'user', content: [{ type: 'text', text: 'hello' }] },
    ]);
    // A row with no version reads as version 1.
    const { formatVersion: _, ...unversioned } = { ...user, formatVersion: undefined };
    expect(toModelMessages([unversioned as PersistableAction])).toHaveLength(1);
  });

  it('isReadableAction gates on the version only', () => {
    expect(isReadableAction({ ...base(), type: 'text', role: 'user', text: 'x', formatVersion: 1 })).toBe(true);
    expect(isReadableAction({ ...base(), type: 'turn-start', formatVersion: 2, ignorable: true })).toBe(false);
    expect(() => isReadableAction({ ...base(), type: 'turn-start', formatVersion: 2 })).toThrow(UnsupportedActionError);
  });

  describe.each([
    ['InMemoryActionStorage', () => new InMemoryActionStorage()],
    ['InMemoryMemory', () => new InMemoryMemory({ db: new InMemoryDB() })],
  ])('%s', (_name, create) => {
    it('round-trips thread events with format version and the ignorable flag', async () => {
      const store = create();
      const actions = threadEvents();
      await store.saveActions({ actions });

      const listed = await store.listActions({ threadId: 't1' });
      expect(listed).toEqual(actions.map(toStoredAction));
      expect(listed.every(a => a.formatVersion === ACTION_FORMAT_VERSION)).toBe(true);
    });

    it('stores goal changes and verdicts exactly as written, with no merging or defaults', async () => {
      const store = create();
      const actions = goalLifecycle();
      await store.saveActions({ actions });

      const listed = await store.listActions({ threadId: 't1' });
      expect(listed).toEqual(actions.map(toStoredAction));
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
