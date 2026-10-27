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

  const memoryCards = ['leak', 'recall', 'threads'].map(id =>
    card(`memory-${id}`, { stages: ['triage'], triageType: 'feature request', metadata: { labels: ['Memory'] } }),
  );

  const quietBoard = [
    done('shipped', 2),
    card('bug', { stages: ['triage'], triageType: 'bug' }),
    card('new', { stages: ['intake'] }),
    pullRequest(1, ['intake'], { sourceCreatedAt: daysAgo(2) }),
    pullRequest(3, ['intake'], { sourceCreatedAt: daysAgo(45) }),
    ...memoryCards,
  ];

  it('ranks fresh pull requests, decisions, intake, bugs, the area sweep and stale pull requests', () => {
    expect(build(quietBoard).map(({ kind }) => kind)).toEqual(['review', 'decide', 'triage', 'bug', 'sweep', 'stale']);
  });

  it('puts failed runs and review feedback first and shows six cards at most', () => {
    const prompts = build(
      [
        ...quietBoard,
        pullRequest(2, ['review'], { factoryAuthored: true, reviewVerdict: 'request changes' }),
        card('stuck', { stages: ['execute'] }),
      ],
      [failedRun('stuck', 'Sandbox quota exceeded')],
    );

    expect(prompts.map(({ kind }) => kind)).toEqual(['unblock', 'feedback', 'review', 'decide', 'triage', 'bug']);
  });

  it('shows how long the oldest fresh pull request has waited, leaving out drafts, finished ones and those in review', () => {
    const review = promptFor('review', [
      pullRequest(2, ['intake'], { sourceCreatedAt: daysAgo(1) }),
      pullRequest(1, ['intake'], { sourceCreatedAt: daysAgo(10) }),
      pullRequest(3, ['intake'], { draft: true }),
      pullRequest(4, ['done'], { merged: true }),
      pullRequest(5, ['canceled'], { state: 'closed' }),
      pullRequest(6, ['review']),
    ]);

    expect(review).toMatchObject({
      label: 'Longest review wait',
      value: 10,
      unit: 'days',
      action: 'Review the 2 oldest',
    });
  });

  it('hands pull requests open over a month to a close-or-keep suggestion instead of review', () => {
    const cards = [
      pullRequest(1, ['intake'], { sourceCreatedAt: daysAgo(31) }),
      pullRequest(2, ['intake'], { sourceCreatedAt: daysAgo(90) }),
      pullRequest(3, ['intake'], { sourceCreatedAt: daysAgo(29) }),
      pullRequest(4, ['intake'], { sourceCreatedAt: daysAgo(60), draft: true }),
    ];

    expect(promptFor('stale', cards)).toMatchObject({ value: 2, action: 'Flag what to close' });
    expect(promptFor('review', cards)).toMatchObject({ value: 29, unit: 'days', action: 'Review it' });
  });

  it('asks for a decision on the cards triage classified that nobody accepted, leaving bugs and started work out', () => {
    const decide = promptFor('decide', [
      card('question', { stages: ['triage'], triageType: 'question/support' }),
      card('feature', { stages: ['intake'], triageType: 'feature request' }),
      card('accepted', { stages: ['triage'], triageType: 'feature request', acceptedAt: daysAgo(1) }),
      card('bug', { stages: ['triage'], triageType: 'bug' }),
      card('unclassified', { stages: ['intake'] }),
      card('building', { stages: ['execute'], triageType: 'feature request' }),
    ]);

    expect(decide).toMatchObject({ label: 'Not yet accepted', value: 2, action: 'Help me decide' });
  });

  it('sweeps the area label with the most open cards, ignoring process labels and GitHub type labels', () => {
    const sweep = promptFor('sweep', [
      ...memoryCards.map(item => ({ ...item, metadata: { labels: ['Memory', 'enhancement', 'p: high'] } })),
      card('agents-1', { metadata: { labels: ['Agents', 'enhancement', 'p: high'] } }),
      card('agents-2', { metadata: { labels: ['Agents', 'enhancement', 'status: needs triage'] } }),
      card('feature', { metadata: { labels: ['enhancement', 'status: needs triage'] } }),
      ...['a', 'b', 'c'].map(id => card(`agents-done-${id}`, { stages: ['done'], metadata: { labels: ['Agents'] } })),
    ]);

    expect(sweep).toMatchObject({ label: 'Memory backlog', value: 3 });
  });

  it('offers no sweep for an area with fewer than three open cards', () => {
    const kinds = build(memoryCards.slice(0, 2)).map(({ kind }) => kind);

    expect(kinds).not.toContain('sweep');
  });

  it('leaves cards triage already classified out of the triage count', () => {
    const triage = promptFor('triage', [
      card('unclassified'),
      card('held-question', { triageType: 'question/support' }),
    ]);

    expect(triage).toMatchObject({ label: 'Untriaged in Intake', value: 1, action: 'Triage it' });
  });

  it('counts every card waiting in Intake but triages a batch of five', () => {
    const triage = promptFor(
      'triage',
      Array.from({ length: 7 }, (_, index) => card(`intake-${index}`)),
    );

    expect(triage).toMatchObject({ value: 7, action: 'Triage the 5 newest' });
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

    expect(plan).toMatchObject({ label: 'Bugs with no plan', value: 2, action: 'Plan a fix for one' });
  });

  it('counts the cards whose last run failed, ignoring runs still queued', () => {
    const unblock = promptFor(
      'unblock',
      [card('failed', { stages: ['execute'] }), card('queued', { stages: ['execute'] })],
      [failedRun('failed', 'Sandbox quota exceeded'), { ...failedRun('queued', ''), status: 'pending' }],
    );

    expect(unblock).toMatchObject({ label: 'Failed runs', value: 1, action: 'Debug and retry it' });
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

    expect(feedback).toMatchObject({ label: 'Changes requested', value: 1 });
  });

  it('sends a prompt that names no card, pull request, error or area, whatever the board holds', () => {
    const busyBoard = [
      ...quietBoard,
      pullRequest(2, ['review'], { factoryAuthored: true, reviewVerdict: 'request changes' }),
      card('stuck', { stages: ['execute'] }),
    ];
    const failures = [failedRun('stuck', 'Sandbox quota exceeded')];
    const prompts = [...build(busyBoard, failures), ...build(quietBoard)];
    const specifics = [...busyBoard.map(item => item.title), 'Sandbox quota exceeded', 'Memory', '#'];

    expect(new Set(prompts.map(({ kind }) => kind)).size).toBe(8);
    for (const { prompt } of prompts) {
      for (const specific of specifics) {
        expect(prompt).not.toContain(specific);
      }
    }
    expect(promptFor('triage', [card('only')]).prompt).toBe(
      promptFor(
        'triage',
        Array.from({ length: 7 }, (_, index) => card(`intake-${index}`)),
      ).prompt,
    );
  });
});
