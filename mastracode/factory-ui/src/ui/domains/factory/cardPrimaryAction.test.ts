import { describe, expect, it, vi } from 'vitest';
import type { ItemRunSpec, RunAction } from './boardRunSpecs';
import { cardPrimaryAction, resumeRunAction } from './cardPrimaryAction';
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
    failureCode: null,
    canRetry: false,
    lastError: null,
    createdAt: '2026-08-30T00:00:00.000Z',
    updatedAt: '2026-08-30T00:00:00.000Z',
    completedAt: null,
  };
}

describe('resumeRunAction', () => {
  it('offers the deepest used seat of a card parked in Intake', () => {
    const sessions = { plan: sessionRef('plan'), work: sessionRef('work') };
    expect(resumeRunAction('intake', spec(investigate, build), sessions)).toBe(build);
  });

  it('offers nothing for a fresh arrival or outside Intake', () => {
    expect(resumeRunAction('intake', spec(review), {})).toBeUndefined();
    expect(resumeRunAction('done', spec(review), { review: sessionRef('review') })).toBeUndefined();
  });
});

describe('cardPrimaryAction', () => {
  it('resumes a parked card instead of leaving Open session as the only way back', () => {
    const runSpec = spec(review);
    const onRestartRun = vi.fn();
    const action = cardPrimaryAction({
      item: item({ review: sessionRef('review') }),
      runSpec,
      resumeAction: review,
      hasSession: true,
      onApproveProposal: vi.fn(),
      onStartRun: vi.fn(),
      onRestartRun,
      onCreateSession: vi.fn(),
    });

    expect(action?.label).toBe('Resume');
    action?.start();
    expect(onRestartRun).toHaveBeenCalledWith(runSpec, review);
  });

  it('still releases a proposed run first: the suggestion beats resuming beside it', () => {
    const onApproveProposal = vi.fn();
    const action = cardPrimaryAction({
      item: item({ review: sessionRef('review') }),
      runSpec: spec(review),
      resumeAction: review,
      proposal: proposalSummary(),
      hasSession: true,
      onApproveProposal,
      onStartRun: vi.fn(),
      onRestartRun: vi.fn(),
      onCreateSession: vi.fn(),
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
    });

    expect(action?.label).toBe('Review');
    action?.start();
    expect(onStartRun).toHaveBeenCalledWith(runSpec, review);
  });
});
