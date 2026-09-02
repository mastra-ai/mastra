import { describe, expect, it, vi } from 'vitest';
import type { ItemRunSpec, RunAction } from './boardRunSpecs';
import { cardActions, cardPrimaryAction, resumeTarget } from './cardPrimaryAction';
import type { CardAction } from './cardPrimaryAction';
import type { FactoryDecisionSummary } from './services/decisions';
import type { WorkItem, WorkItemSessionRef } from './services/workItems';

const review: RunAction = {
  label: 'Review',
  role: 'review',
  invocation: { type: 'skill', skillName: 'factory-review', arguments: 'PR #1' },
};

const investigate: RunAction = {
  label: 'Investigate',
  role: 'plan',
  invocation: { type: 'skill', skillName: 'factory-triage', arguments: 'issue #1' },
};

const investigateTriage: RunAction = {
  label: 'Investigate',
  role: 'triage',
  invocation: { type: 'skill', skillName: 'factory-triage', arguments: 'issue #1' },
};

const build: RunAction = {
  label: 'Build',
  role: 'work',
  invocation: { type: 'prompt', prompt: 'Implement a fix for issue #1' },
};

function spec(...actions: RunAction[]): ItemRunSpec {
  return { branch: 'factory/pr-1', threadTitle: 'PR: one', actions };
}

function sessionRef(role: string): WorkItemSessionRef {
  return { sessionId: `session-${role}`, branch: 'factory/pr-1', threadId: `thread-${role}`, startedBy: 'user-1' };
}

function item(sessions: Record<string, WorkItemSessionRef>): WorkItem {
  return {
    id: 'item-1',
    orgId: 'org-1',
    createdBy: 'user-1',
    githubProjectId: 'project-1',
    source: 'github-pr',
    sourceKey: 'github-pr:1',
    parentWorkItemId: null,
    title: 'one',
    url: null,
    stages: ['intake'],
    stageHistory: [],
    sessions,
    metadata: {},
    commentCount: 0,
    feedActivityAt: null,
    revision: 1,
    createdAt: '2026-08-30T00:00:00.000Z',
    updatedAt: '2026-08-30T00:00:00.000Z',
  };
}

function proposalSummary(): FactoryDecisionSummary {
  return {
    id: 'decision-1',
    evaluationId: 'evaluation-1',
    workItemId: 'item-1',
    type: 'invokeSkill',
    role: 'review',
    status: 'proposed',
    attempts: 0,
    failureOccurrence: 0,
    source: null,
    failureCode: null,
    canRetry: false,
    lastError: null,
    createdAt: '2026-08-30T00:00:00.000Z',
    updatedAt: '2026-08-30T00:00:00.000Z',
    completedAt: null,
  };
}

describe('resumeTarget', () => {
  it('resumes the deepest used seat of a card parked in Intake', () => {
    const sessions = { plan: sessionRef('plan'), work: sessionRef('work') };
    expect(resumeTarget('intake', spec(investigate, build), sessions)).toEqual({ kind: 'run', action: build });
  });

  it('re-enters the lane of a used seat the board cannot start directly', () => {
    // A GitHub issue offers Investigate (triage) and Build (work); plan is rule-only,
    // so a card parked mid-Planning must go back to Planning, not restart the triage run.
    const sessions = { triage: sessionRef('triage'), plan: sessionRef('plan') };
    expect(resumeTarget('intake', spec(investigateTriage, build), sessions)).toEqual({
      kind: 'move',
      stage: 'planning',
    });
  });

  it('re-enters the lane even when the card offers no runs at all', () => {
    const sessions = { plan: sessionRef('plan') };
    expect(resumeTarget('intake', undefined, sessions)).toEqual({ kind: 'move', stage: 'planning' });
  });

  it('offers nothing for a fresh arrival or outside Intake', () => {
    expect(resumeTarget('intake', spec(review), {})).toBeUndefined();
    expect(resumeTarget('done', spec(review), { review: sessionRef('review') })).toBeUndefined();
  });
});

describe('cardPrimaryAction', () => {
  it('resumes a parked card instead of leaving Open session as the only way back', () => {
    const runSpec = spec(review);
    const onRestartRun = vi.fn();
    const action = cardPrimaryAction({
      item: item({ review: sessionRef('review') }),
      runSpec,
      resume: { kind: 'run', action: review },
      hasSession: true,
      onApproveProposal: vi.fn(),
      onStartRun: vi.fn(),
      onRestartRun,
      onCreateSession: vi.fn(),
      onMove: vi.fn(),
    });

    expect(action?.label).toBe('Resume');
    action?.start();
    expect(onRestartRun).toHaveBeenCalledWith(runSpec, review);
  });

  it('resumes a rule-only seat by re-entering its lane', () => {
    const onMove = vi.fn();
    const action = cardPrimaryAction({
      item: item({ plan: sessionRef('plan') }),
      runSpec: spec(build),
      resume: { kind: 'move', stage: 'planning' },
      hasSession: true,
      onApproveProposal: vi.fn(),
      onStartRun: vi.fn(),
      onRestartRun: vi.fn(),
      onCreateSession: vi.fn(),
      onMove,
    });

    expect(action?.label).toBe('Resume');
    action?.start();
    expect(onMove).toHaveBeenCalledWith('planning');
  });

  it('still releases a proposed run first: the suggestion beats resuming beside it', () => {
    const onApproveProposal = vi.fn();
    const action = cardPrimaryAction({
      item: item({ review: sessionRef('review') }),
      runSpec: spec(review),
      resume: { kind: 'run', action: review },
      proposal: proposalSummary(),
      hasSession: true,
      onApproveProposal,
      onStartRun: vi.fn(),
      onRestartRun: vi.fn(),
      onCreateSession: vi.fn(),
      onMove: vi.fn(),
    });

    expect(action?.label).toBe('Review');
    action?.start();
    expect(onApproveProposal).toHaveBeenCalledWith('decision-1');
  });

  it('keeps Start for a fresh arrival with no seat used', () => {
    const runSpec = spec(review);
    const onStartRun = vi.fn();
    const action = cardPrimaryAction({
      item: item({}),
      runSpec,
      runAction: review,
      hasSession: false,
      onApproveProposal: vi.fn(),
      onStartRun,
      onRestartRun: vi.fn(),
      onCreateSession: vi.fn(),
      onMove: vi.fn(),
    });

    expect(action?.label).toBe('Review');
    action?.start();
    expect(onStartRun).toHaveBeenCalledWith(runSpec, review);
  });
});

describe('cardActions', () => {
  const session = { label: 'Open session', href: '/session' };
  const retry = { label: 'Retry', start: vi.fn() };
  const run = { label: 'Investigate', start: vi.fn() };

  it('leads with the likeliest click and offers a rival run only beside an idle session', () => {
    const idle = { running: false, waiting: false, attention: false };
    const labels = (actions: CardAction[]) => actions.map(action => action.label);
    expect(labels(cardActions({ ...idle, session, run }))).toEqual(['Investigate', 'Open session']);
    expect(labels(cardActions({ ...idle, session, retry, run }))).toEqual(['Retry', 'Open session', 'Investigate']);
    expect(labels(cardActions({ ...idle, running: true, session, run }))).toEqual(['Open session']);
    expect(labels(cardActions({ ...idle, running: true, waiting: true, session, run }))).toEqual([
      'Investigate',
      'Open session',
    ]);
    expect(cardActions(idle)).toEqual([]);
  });

  it('lights only the click the card waits on a person for', () => {
    const idle = { running: false, waiting: false, attention: false };
    const lit = (actions: CardAction[]) => actions.filter(action => action.urgent).map(action => action.label);
    expect(lit(cardActions({ ...idle, session, run }))).toEqual([]);
    expect(lit(cardActions({ ...idle, session, retry, run }))).toEqual(['Retry']);
    expect(lit(cardActions({ ...idle, running: true, waiting: true, session, run }))).toEqual(['Investigate']);
    expect(lit(cardActions({ ...idle, running: true, attention: true, session, run }))).toEqual(['Open session']);
  });
});
