import { describe, expect, it } from 'vitest';

import { cardContextSessions, cardThreadSession, contextLabel, itemThreadSession } from './card-context-sessions.js';
import type { ContextPhase } from './card-context-sessions.js';

const WORK_PHASES: ContextPhase[] = [
  { id: 'intake', name: 'Intake', title: 'Intake' },
  { id: 'triage', name: 'Triage', title: 'Triage', context: 'triage', role: 'triage' },
  { id: 'planning', name: 'Planning', title: 'Planning', context: 'work', role: 'work' },
  { id: 'execute', name: 'Building', title: 'Building', context: 'work', role: 'work' },
  { id: 'review', name: 'Review', title: 'Review', context: 'work', role: 'work' },
  { id: 'pr-review', name: 'PR review', title: 'PR review', context: 'work', role: 'work' },
  { id: 'done', name: 'Done', title: 'Done' },
  { id: 'canceled', name: 'Canceled', title: 'Canceled' },
];

const RELEASE_PHASES: ContextPhase[] = [
  { id: 'queued', title: 'Queued' },
  { id: 'preparing', title: 'Preparing', role: 'release-preparer' },
  { id: 'shipping', title: 'Shipping', role: 'release-publisher' },
  { id: 'shipped', title: 'Shipped' },
];

describe('itemThreadSession', () => {
  const session = (id: string) => ({ sessionId: id, threadId: id });

  it('keeps the original triage conversation when session keys arrive in different orders', () => {
    const triage = session('triage-session');
    const work = session('work-session');

    expect(itemThreadSession({ triage, plan: work, work })).toBe(triage);
    expect(itemThreadSession({ work, plan: work, triage })).toBe(triage);
  });

  it('falls back to a custom role session', () => {
    const custom = session('custom-session');

    expect(itemThreadSession({ release: custom })).toBe(custom);
  });
});

describe('card sessions by context', () => {
  const session = (id: string) => ({ sessionId: id, threadId: `${id}-thread` });
  const visit = (stage: string) => ({ stage });
  const triage = session('triage-session');
  const work = session('work-session');
  const review = session('review-session');

  it('names a context after its only phase, else by its well-known name, else by its key', () => {
    expect(contextLabel('release-preparer', RELEASE_PHASES)).toBe('Preparing');
    expect(contextLabel('triage', WORK_PHASES)).toBe('Triage');
    expect(contextLabel('work', WORK_PHASES)).toBe('Work');
    expect(contextLabel('review', WORK_PHASES)).toBe('Review');
    expect(contextLabel('plan', WORK_PHASES)).toBe('Planning');
    expect(contextLabel('deploy-check', WORK_PHASES)).toBe('Deploy-check');
    expect(contextLabel('work', undefined)).toBe('Work');
  });

  it("lists the current phase's context first, then the most recently visited, then the rest", () => {
    const item = {
      sessions: { review, triage, work },
      stageHistory: [visit('intake'), visit('triage'), visit('execute')],
    };

    expect(cardContextSessions(item, WORK_PHASES, 'execute')).toEqual([
      { context: 'work', label: 'Work', ref: work, current: true },
      { context: 'triage', label: 'Triage', ref: triage, current: false },
      { context: 'review', label: 'Review', ref: review, current: false },
    ]);
    expect(cardThreadSession(item, WORK_PHASES, 'execute')).toBe(work);
  });

  it('opens the last visited context when the current phase holds no session', () => {
    const item = {
      sessions: { triage, work },
      stageHistory: [visit('triage'), visit('planning'), visit('intake')],
    };

    expect(cardThreadSession(item, WORK_PHASES, 'intake')).toBe(work);
    expect(cardContextSessions(item, WORK_PHASES, 'intake').map(entry => [entry.context, entry.current])).toEqual([
      ['work', false],
      ['triage', false],
    ]);
  });

  it('lists a session filed under a legacy plan key and work once, under the current context', () => {
    const item = { sessions: { plan: work, work }, stageHistory: [] };

    expect(cardContextSessions(item, WORK_PHASES, 'planning')).toEqual([
      { context: 'work', label: 'Work', ref: work, current: true },
    ]);
  });

  it("opens a Work card's planner under the legacy plan key while it is in Planning", () => {
    const plan = session('plan-session');
    const item = { sessions: { triage, plan }, stageHistory: [] };

    expect(cardThreadSession(item, WORK_PHASES, 'planning')).toBe(plan);
    expect(cardContextSessions(item, WORK_PHASES, 'planning')).toEqual([
      { context: 'work', label: 'Work', ref: plan, current: true },
      { context: 'triage', label: 'Triage', ref: triage, current: false },
    ]);
  });

  it('keeps the lifecycle order without a board catalog', () => {
    const item = { sessions: { work, triage }, stageHistory: [] };

    expect(cardThreadSession(item, undefined, 'execute')).toBe(triage);
    expect(cardContextSessions(item, undefined, 'execute').map(entry => entry.label)).toEqual(['Work', 'Triage']);
  });

  it('falls back to the lifecycle order when no visited phase holds a session', () => {
    const plan = session('plan-session');
    const item = { sessions: { chat: work, plan }, stageHistory: [] };

    expect(cardThreadSession(item, WORK_PHASES, 'planning')).toBe(plan);
  });
});
