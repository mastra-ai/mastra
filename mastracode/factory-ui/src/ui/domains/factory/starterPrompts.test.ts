import { describe, expect, it } from 'vitest';

import type { FactoryDecisionSummary } from './services/decisions';
import type { WorkItem } from './services/workItems';
import { starterPrompts } from './starterPrompts';
import type { StarterKind } from './starterPrompts';

const NOW = new Date('2026-10-26T12:00:00.000Z');
const DAY = 24 * 60 * 60 * 1000;

function daysAgo(days: number): string {
  return new Date(NOW.getTime() - days * DAY).toISOString();
}

function card(id: string, overrides: Partial<WorkItem> = {}): WorkItem {
  return {
    id,
    orgId: 'org-1',
    createdBy: 'user-1',
    githubProjectId: 'repo-1',
    board: 'work',
    source: 'manual',
    sourceKey: null,
    parentWorkItemId: null,
    title: `Card ${id}`,
    url: null,
    stages: ['intake'],
    stageHistory: [],
    sessions: {},
    metadata: {},
    triageType: null,
    acceptedAt: null,
    commentCount: 0,
    feedActivityAt: null,
    revision: 1,
    createdAt: daysAgo(30),
    updatedAt: daysAgo(30),
    ...overrides,
  };
}

function pullRequest(number: number, stages: string[], metadata: Record<string, unknown> = {}): WorkItem {
  return card(`pr-${number}`, {
    board: 'review',
    source: 'github-pr',
    title: `Pull request ${number}`,
    stages,
    metadata: { githubPullRequestNumber: number, state: 'open', ...metadata },
  });
}

function done(id: string, doneDaysAgo: number): WorkItem {
  return card(id, {
    stages: ['done'],
    stageHistory: [{ stage: 'done', enteredAt: daysAgo(doneDaysAgo), by: 'user-1' }],
  });
}

function failedRun(workItemId: string, lastError: string): FactoryDecisionSummary {
  return {
    id: `decision-${workItemId}`,
    evaluationId: 'evaluation-1',
    workItemId,
    type: 'startSession',
    role: 'work',
    source: null,
    status: 'failed',
    attempts: 3,
    failureOccurrence: 1,
    failureCode: null,
    canRetry: true,
    lastError,
    createdAt: daysAgo(1),
    updatedAt: daysAgo(1),
    completedAt: daysAgo(1),
  };
}

function build(cards: WorkItem[], effects: FactoryDecisionSummary[] = []) {
  const effectByItem = new Map(effects.map(effect => [effect.workItemId ?? '', effect]));
  return starterPrompts({ cards, effectByItem, now: NOW });
}

function promptFor(kind: StarterKind, cards: WorkItem[], effects: FactoryDecisionSummary[] = []) {
  const found = build(cards, effects).find(prompt => prompt.kind === kind);
  if (!found) throw new Error(`No ${kind} prompt`);
  return found;
}

function listed(prompt: string): string[] {
  return prompt
    .split('\n')
    .filter(line => line.startsWith('- '))
    .map(line => line.slice(2));
}

describe('starterPrompts', () => {
  it('offers nothing when no card waits on anyone', () => {
    expect(
      build([
        done('shipped-long-ago', 30),
        card('canceled', { stages: ['canceled'] }),
        card('building', { stages: ['execute'] }),
        pullRequest(9, ['done'], { merged: true }),
      ]),
    ).toEqual([]);
  });

  it('puts failed runs first, then review feedback, open pull requests, intake, bugs and the weekly recap', () => {
    const prompts = build(
      [
        done('shipped', 2),
        card('bug', { stages: ['triage'], triageType: 'bug' }),
        card('new', { stages: ['intake'] }),
        pullRequest(1, ['intake']),
        pullRequest(2, ['review'], { factoryAuthored: true, reviewVerdict: 'request changes' }),
        card('stuck', { stages: ['execute'] }),
      ],
      [failedRun('stuck', 'Sandbox quota exceeded')],
    );

    expect(prompts.map(({ title }) => title)).toEqual([
      'Unblock 1 failed run',
      'Fix review feedback on 1 Factory pull request',
      'Review 1 open pull request',
      'Triage 1 card in Intake',
      'Plan a fix for the open bug',
      'Recap 1 card done this week',
    ]);
  });

  it('reviews the open pull requests that waited longest, leaving out drafts, finished ones and those in review', () => {
    const review = promptFor('review', [
      pullRequest(2, ['intake'], { sourceCreatedAt: daysAgo(1) }),
      pullRequest(1, ['intake'], { sourceCreatedAt: daysAgo(10) }),
      pullRequest(3, ['intake'], { draft: true }),
      pullRequest(4, ['done'], { merged: true }),
      pullRequest(5, ['canceled'], { state: 'closed' }),
      pullRequest(6, ['review']),
    ]);

    expect(review.title).toBe('Review 2 open pull requests');
    expect(listed(review.prompt)).toEqual(['#1 Pull request 1', '#2 Pull request 2']);
  });

  it('leaves cards triage already classified to a person, out of the triage prompt', () => {
    const triage = promptFor('triage', [
      card('unclassified'),
      card('held-question', { triageType: 'question/support' }),
    ]);

    expect(listed(triage.prompt)).toEqual(['Card unclassified']);
  });

  it('triages the five newest cards in Intake and leaves the rest for another session', () => {
    const cards = Array.from({ length: 7 }, (_, index) =>
      card(`intake-${index}`, { stageHistory: [{ stage: 'intake', enteredAt: daysAgo(index), by: 'user-1' }] }),
    );

    const triage = promptFor('triage', cards);

    expect(triage.title).toBe('Triage 5 of 7 cards in Intake');
    expect(listed(triage.prompt)).toEqual([
      'Card intake-0',
      'Card intake-1',
      'Card intake-2',
      'Card intake-3',
      'Card intake-4',
    ]);
    expect(triage.prompt).toMatch(/\bother 2\b/);
  });

  it('plans only the bugs nobody has planned or started', () => {
    const plan = promptFor('bug', [
      card('triaged-bug', { stages: ['triage'], triageType: 'bug' }),
      card('labelled-bug', { stages: ['intake'], metadata: { labels: ['Bug'] } }),
      card('planned-bug', {
        stages: ['triage'],
        triageType: 'bug',
        sessions: { plan: { sessionId: 's-1', branch: 'b', threadId: 't', startedBy: 'user-1' } },
      }),
      card('building-bug', { stages: ['execute'], triageType: 'bug' }),
      card('feature', { stages: ['triage'], triageType: 'feature request' }),
    ]);

    expect(plan.title).toBe('Plan a fix for one of 2 open bugs');
    expect(listed(plan.prompt)).toEqual(['Card triaged-bug', 'Card labelled-bug']);
  });

  it('plans one bug picked from every open bug, with the oldest as examples', () => {
    const bugs = Array.from({ length: 7 }, (_, index) =>
      card(`bug-${index}`, { stages: ['triage'], triageType: 'bug', createdAt: daysAgo(10 - index) }),
    );

    const plan = promptFor('bug', bugs);

    expect(plan.title).toBe('Plan a fix for one of 7 open bugs');
    expect(plan.prompt).toContain('of the 7 open bugs');
    expect(plan.prompt).not.toContain('Leave the other');
    expect(listed(plan.prompt)).toEqual(['Card bug-0', 'Card bug-1', 'Card bug-2', 'Card bug-3', 'Card bug-4']);
  });

  it('recaps the cards that reached Done in the last seven days and are still there', () => {
    const recap = promptFor('shipped', [
      done('inside-the-week', 6.9),
      done('outside-the-week', 7.1),
      card('reopened', {
        stages: ['execute'],
        stageHistory: [{ stage: 'done', enteredAt: daysAgo(2), exitedAt: daysAgo(1), by: 'user-1' }],
      }),
    ]);

    expect(listed(recap.prompt)).toEqual(['Card inside-the-week']);
  });

  it('gives the recap its scale and start date, with the latest ten as examples', () => {
    const recap = promptFor('shipped', [
      ...Array.from({ length: 11 }, (_, index) => done(`work-${index}`, index / 10)),
      {
        ...pullRequest(1, ['done'], { merged: true }),
        stageHistory: [{ stage: 'done', enteredAt: daysAgo(3), by: 'github:octocat' }],
      },
    ]);

    expect(recap.title).toBe('Recap 12 cards done this week');
    expect(recap.prompt).toContain('since 2026-10-19');
    expect(recap.prompt).toContain('1 pull request and 11 cards');
    expect(listed(recap.prompt)).toEqual(Array.from({ length: 10 }, (_, index) => `Card work-${index}`));
  });

  it('unblocks the cards whose last run failed, with the error, ignoring runs still queued', () => {
    const unblock = promptFor(
      'unblock',
      [card('failed', { stages: ['execute'] }), card('queued', { stages: ['execute'] })],
      [failedRun('failed', 'Sandbox quota exceeded'), { ...failedRun('queued', ''), status: 'pending' }],
    );

    expect(unblock.title).toBe('Unblock 1 failed run');
    expect(listed(unblock.prompt)).toEqual(['Card failed: Sandbox quota exceeded']);
  });

  it('fixes review feedback only on open Factory pull requests whose verdict is still current', () => {
    const feedback = promptFor('feedback', [
      pullRequest(1, ['review'], {
        factoryAuthored: true,
        reviewVerdict: 'request changes',
        reviewedHeadSha: 'abc',
        pullRequestHeadSha: 'ABC',
      }),
      pullRequest(2, ['review'], { reviewVerdict: 'request changes' }),
      pullRequest(3, ['review'], {
        factoryAuthored: true,
        reviewVerdict: 'request changes',
        reviewedHeadSha: 'abc',
        pullRequestHeadSha: 'def',
      }),
      pullRequest(4, ['review'], { factoryAuthored: true, reviewVerdict: 'approve' }),
      pullRequest(5, ['done'], { factoryAuthored: true, reviewVerdict: 'request changes', merged: true }),
    ]);

    expect(listed(feedback.prompt)).toEqual(['#1 Pull request 1']);
  });
});
