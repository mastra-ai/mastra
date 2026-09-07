import { describe, expect, it, vi } from 'vitest';
import { cardActions, cardMoves, cardPrimaryAction, resumeStage } from './cardPrimaryAction';
import type { CardAction, CardMove } from './cardPrimaryAction';
import type { WorkItem, WorkItemSessionRef } from './services/workItems';

const investigate: CardMove = { label: 'Investigate', role: 'triage', stage: 'triage' };
const build: CardMove = { label: 'Build', role: 'work', stage: 'execute' };
const review: CardMove = { label: 'Review', role: 'review', stage: 'review' };

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
    triageType: null,
    acceptedAt: null,
    commentCount: 0,
    feedActivityAt: null,
    revision: 1,
    createdAt: '2026-08-30T00:00:00.000Z',
    updatedAt: '2026-08-30T00:00:00.000Z',
  };
}

describe('cardMoves', () => {
  it('offers an issue its two lanes, and a needs-approval issue only the decision', () => {
    const issue = { source: 'github-issue' as const, metadata: {} };
    expect(cardMoves(issue, 'intake')).toEqual([investigate, build]);
    expect(cardMoves({ ...issue, metadata: { labels: ['Status: Needs Approval'] } }, 'intake')).toEqual([
      { label: 'Prepare approval', role: 'triage', stage: 'triage', awaitsHumanDecision: true },
    ]);
    // Accepted, so the label is stale until the source catches up.
    expect(
      cardMoves(
        { ...issue, metadata: { labels: ['Status: Needs Approval'] }, acceptedAt: '2026-08-30T00:00:00.000Z' },
        'triage',
      ),
    ).toEqual([investigate, build]);
  });

  it('re-reviews an open pull request sitting in Done, and reviews it in a working lane', () => {
    const pullRequest = { source: 'github-pr' as const, metadata: { state: 'open' }, stages: ['done'] };
    expect(cardMoves(pullRequest, 'done')).toEqual([{ label: 'Re-review', role: 'review', stage: 'review' }]);
    expect(cardMoves(pullRequest, 'review')).toEqual([review]);
  });

  it('offers a Work card in Review no lane, so its session is the action', () => {
    expect(cardMoves({ source: 'github-issue', metadata: {} }, 'review')).toEqual([]);
    expect(cardMoves({ source: 'linear-issue', metadata: {} }, 'review')).toEqual([]);
  });

  it('offers a finished card no lane, so its session is the action', () => {
    expect(cardMoves({ source: 'github-pr', metadata: { merged: true }, stages: ['done'] }, 'done')).toEqual([]);
    expect(cardMoves({ source: 'github-pr', metadata: { state: 'open' } }, 'canceled')).toEqual([]);
    expect(cardMoves({ source: 'github-issue', metadata: {} }, 'done')).toEqual([]);
  });

  it('offers nothing for a manual card', () => {
    expect(cardMoves({ source: 'manual', metadata: {} }, 'intake')).toEqual([]);
  });
});

describe('resumeStage', () => {
  it('re-enters the lane of the deepest seat a card parked in Intake has used', () => {
    expect(resumeStage('intake', { triage: sessionRef('triage'), plan: sessionRef('plan') })).toBe('planning');
    expect(resumeStage('intake', { plan: sessionRef('plan'), work: sessionRef('work') })).toBe('execute');
  });

  it('offers nothing for a fresh arrival or outside Intake', () => {
    expect(resumeStage('intake', {})).toBeUndefined();
    expect(resumeStage('done', { review: sessionRef('review') })).toBeUndefined();
  });
});

describe('cardPrimaryAction', () => {
  const handlers = {
    onApproveProposal: vi.fn(),
    onCreateSession: vi.fn(),
    onMove: vi.fn(),
  };

  it('resumes a parked card instead of leaving Open session as the only way back', () => {
    const onMove = vi.fn();
    const action = cardPrimaryAction({
      ...handlers,
      item: item({ plan: sessionRef('plan') }),
      move: build,
      resumeStage: 'planning',
      hasSession: true,
      onMove,
    });

    expect(action?.label).toBe('Resume');
    action?.start();
    expect(onMove).toHaveBeenCalledWith('planning');
  });

  it('asks for the maintainer decision on a held non-bug card instead of offering its lane', () => {
    const onMove = vi.fn();
    const held = { ...item({ triage: sessionRef('triage') }), triageType: 'feature request' as const };
    const action = cardPrimaryAction({
      ...handlers,
      item: held,
      columnStage: 'triage',
      move: build,
      hasSession: true,
      onMove,
    });

    expect(action?.label).toBe('Accept');
    expect(action?.ariaLabel).toBe('Accept and plan');
    action?.start();
    expect(onMove).toHaveBeenCalledWith('planning');
  });

  it('keeps the maintainer decision ahead of a suggested run on a held card', () => {
    const onMove = vi.fn();
    const onApproveProposal = vi.fn();
    const held = { ...item({ triage: sessionRef('triage') }), triageType: 'feature request' as const };
    const action = cardPrimaryAction({
      ...handlers,
      item: held,
      columnStage: 'triage',
      move: build,
      waiting: { label: 'Review', decisionId: 'decision-1' },
      hasSession: true,
      onApproveProposal,
      onMove,
    });

    expect(action?.label).toBe('Accept');
    action?.start();
    expect(onMove).toHaveBeenCalledWith('planning');
    expect(onApproveProposal).not.toHaveBeenCalled();
  });

  it('offers the lane again once the card is accepted, and never holds bugs', () => {
    const base = { ...item({ triage: sessionRef('triage') }), triageType: 'feature request' as const };
    const args = { ...handlers, columnStage: 'triage' as const, move: build, hasSession: true };
    expect(cardPrimaryAction({ ...args, item: { ...base, acceptedAt: '2026-08-30T00:00:00.000Z' } })?.label).toBe(
      'Build',
    );
    expect(cardPrimaryAction({ ...args, item: { ...base, triageType: 'bug' } })?.label).toBe('Build');
    expect(cardPrimaryAction({ ...args, item: base, columnStage: 'planning' })?.label).toBe('Build');
  });

  it('still releases a proposed run first: the suggestion beats resuming beside it', () => {
    const onApproveProposal = vi.fn();
    const action = cardPrimaryAction({
      ...handlers,
      item: item({ review: sessionRef('review') }),
      move: review,
      resumeStage: 'review',
      waiting: { label: 'Review', decisionId: 'decision-1' },
      hasSession: true,
      onApproveProposal,
    });

    expect(action?.label).toBe('Review');
    action?.start();
    expect(onApproveProposal).toHaveBeenCalledWith('decision-1');
  });

  it('moves the card into the lane it names', () => {
    const onMove = vi.fn();
    const action = cardPrimaryAction({ ...handlers, item: item({}), move: review, hasSession: false, onMove });

    expect(action?.label).toBe('Review');
    action?.start();
    expect(onMove).toHaveBeenCalledWith('review');
  });

  it('falls back to opening a session on a card with no lane to offer', () => {
    const onCreateSession = vi.fn();
    const action = cardPrimaryAction({ ...handlers, item: item({}), hasSession: false, onCreateSession });

    expect(action?.label).toBe('Start session');
    action?.start();
    expect(onCreateSession).toHaveBeenCalledWith({ branch: 'factory/item-item-1', threadTitle: 'one' });
  });
});

describe('cardActions', () => {
  const session = { label: 'Open session', href: '/session' };
  const retry = { label: 'Retry', start: vi.fn() };
  const run = { label: 'Investigate', start: vi.fn() };

  it('leads with the likeliest click and offers a rival run only beside an idle session', () => {
    const idle = { running: false, waiting: false };
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
    const idle = { running: false, waiting: false };
    const lit = (actions: CardAction[]) => actions.filter(action => action.urgent).map(action => action.label);
    expect(lit(cardActions({ ...idle, session, run }))).toEqual([]);
    expect(lit(cardActions({ ...idle, session, retry, run }))).toEqual(['Retry']);
    expect(lit(cardActions({ ...idle, running: true, waiting: true, session, run }))).toEqual(['Investigate']);
  });
});
