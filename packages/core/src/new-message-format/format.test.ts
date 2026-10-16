import { describe, expect, it } from 'vitest';
import { InMemoryDB } from '../storage/domains/inmemory-db';
import { InMemoryMemory } from '../storage/domains/memory/inmemory';
import { InMemoryActionStorage } from './storage';
import { toModelMessages } from './to-model-messages';
import type { PersistableAction } from './types';
import { ACTION_FORMAT_VERSION, isReadableAction, toStoredAction } from './types';
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
  it('stamps the format version and nothing else', () => {
    const userText: PersistableAction = { ...base(), type: 'text', role: 'user', text: 'hi' };
    expect(toStoredAction(userText)).toEqual({ ...userText, formatVersion: ACTION_FORMAT_VERSION });
    expect(toStoredAction({ ...base(), type: 'text', role: 'user', text: 'x', formatVersion: 7 }).formatVersion).toBe(
      7,
    );
    for (const action of [...threadEvents(), ...goalLifecycle()]) {
      expect(toStoredAction(action)).toEqual({ ...action, formatVersion: ACTION_FORMAT_VERSION });
    }
  });

  it('keeps thread events out of the prompt', () => {
    const prompt = toModelMessages([{ ...base(), type: 'text', role: 'user', text: 'hello' }, ...threadEvents()]);
    expect(prompt).toEqual([{ role: 'user', content: [{ type: 'text', text: 'hello' }] }]);
  });

  it('skips rows of a type this reader does not know', () => {
    const user = { ...base(), type: 'text', role: 'user', text: 'hello' } as PersistableAction;
    const future = { ...base(), type: 'retract', formatVersion: 2 } as unknown as PersistableAction;
    const sameVersion = { ...base(), type: 'usage' } as unknown as PersistableAction;
    expect(toModelMessages([user, future, sameVersion])).toEqual([
      { role: 'user', content: [{ type: 'text', text: 'hello' }] },
    ]);
  });

  it('skips a known type from a newer format version', () => {
    const user = { ...base(), type: 'text', role: 'user', text: 'hello' } as PersistableAction;
    const newer = { ...base(), type: 'text', role: 'user', text: 'v2 text', formatVersion: 2 } as PersistableAction;
    expect(toModelMessages([user, newer])).toEqual([{ role: 'user', content: [{ type: 'text', text: 'hello' }] }]);
    // A row with no version reads as version 1.
    const { formatVersion: _, ...unversioned } = { ...user, formatVersion: undefined };
    expect(toModelMessages([unversioned as PersistableAction])).toHaveLength(1);
  });

  it('drops a call whose outcome was skipped, and an outcome whose call was skipped', () => {
    const call = (toolCallId: string, extra = {}) =>
      ({
        ...base(),
        type: 'tool-call',
        role: 'assistant',
        toolCallId,
        toolName: 'pick',
        input: {},
        ...extra,
      }) as PersistableAction;
    const result = (toolCallId: string, extra = {}) =>
      ({ ...base(), type: 'tool-result', toolCallId, toolName: 'pick', output: 'blue', ...extra }) as PersistableAction;
    const user = { ...base(), type: 'text', role: 'user', text: 'hello' } as PersistableAction;
    const said = { ...base(), type: 'text', role: 'assistant', text: 'checking' } as PersistableAction;

    expect(toModelMessages([user, said, call('c1'), result('c1', { formatVersion: 2 })])).toEqual([
      { role: 'user', content: [{ type: 'text', text: 'hello' }] },
      { role: 'assistant', content: [{ type: 'text', text: 'checking' }] },
    ]);
    expect(toModelMessages([user, call('c1', { formatVersion: 2 }), result('c1')])).toEqual([
      { role: 'user', content: [{ type: 'text', text: 'hello' }] },
    ]);
    // A complete pair is untouched.
    expect(toModelMessages([user, call('c1'), result('c1')]).flatMap(m => m.content as { type: string }[])).toEqual([
      expect.objectContaining({ type: 'text' }),
      expect.objectContaining({ type: 'tool-call', toolCallId: 'c1' }),
      expect.objectContaining({ type: 'tool-result', toolCallId: 'c1' }),
    ]);
  });

  it('keeps a call waiting on approval, with its request and any answer', () => {
    const user = { ...base(), type: 'text', role: 'user', text: 'delete it' } as PersistableAction;
    const actions = [
      user,
      { ...base(), type: 'tool-call', role: 'assistant', toolCallId: 'c1', toolName: 'rm', input: {} },
      { ...base(), type: 'tool-approval-requested', approvalId: 'a1', toolCallId: 'c1', toolName: 'rm', input: {} },
      { ...base(), type: 'tool-approval-responded', approvalId: 'a1', toolCallId: 'c1', approved: true },
    ] as PersistableAction[];
    expect(toModelMessages(actions).flatMap(m => (m.content as { type: string }[]).map(p => p.type))).toEqual([
      'text',
      'tool-call',
      'tool-approval-request',
      'tool-approval-response',
    ]);
  });

  it('isReadableAction gates on the version only', () => {
    expect(isReadableAction({ ...base(), type: 'text', role: 'user', text: 'x', formatVersion: 1 })).toBe(true);
    expect(isReadableAction({ ...base(), type: 'text', role: 'user', text: 'x' })).toBe(true);
    expect(isReadableAction({ ...base(), type: 'turn-start', formatVersion: 2 })).toBe(false);
  });

  describe.each([
    ['InMemoryActionStorage', () => new InMemoryActionStorage()],
    ['InMemoryMemory', () => new InMemoryMemory({ db: new InMemoryDB() })],
  ])('%s', (_name, create) => {
    it('round-trips thread events with the format version', async () => {
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
