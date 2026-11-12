import { describe, expect, it } from 'vitest';

import { createBoardRegistry } from '../boards/index.js';
import { triageWorkBoard } from '../boards/test-utils.js';
import type { Card } from '../storage/domains/work-items/base.js';
import { testCard } from './test-utils.js';
import { cardsWithFailedRun, workItemStarters } from './work-item-starters.js';

const NOW = Date.parse('2026-10-26T12:00:00.000Z');
const DAY = 24 * 60 * 60 * 1000;

function daysAgo(days: number): string {
  return new Date(NOW - days * DAY).toISOString();
}

function card(id: string, overrides: Partial<Card> = {}): Card {
  return testCard(id, { createdAt: new Date(NOW - 30 * DAY), ...overrides });
}

/** A card synced from GitHub: its labels live on its work item, not in its metadata. */
function synced(id: string, labels: string[], overrides: Partial<Card> = {}): Card {
  const base = card(id, overrides);
  return { ...base, workItem: { ...base.workItem, provider: 'github', labels } };
}

const TRIAGE_RUN = { sessionId: 's-triage', branch: 'b', threadId: 't', startedBy: 'u1' };

/** Triage ran and left the card in Intake for a person. */
function triaged(id: string, overrides: Partial<Card> = {}): Card {
  return card(id, { sessions: { triage: TRIAGE_RUN }, ...overrides });
}

/**
 * A pull request's own card as storage holds it: what GitHub reports (`source`) on its work item,
 * Factory's review verdict on the card.
 */
function pullRequest(
  number: number,
  stages: string[],
  source: { state?: string | null; draft?: boolean; merged?: boolean; sourceCreatedAt?: string } = {},
  verdict: Record<string, unknown> = {},
): Card {
  const base = card(`pr-${number}`, {
    stages,
    externalSource: { integrationId: 'github', type: 'pull-request', externalId: String(number) },
    metadata: verdict,
  });
  const { state = 'open', ...reported } = source;
  return { ...base, workItem: { ...base.workItem, provider: 'github', state, metadata: reported } };
}

function count(cards: Card[], failedCardIds: string[] = []) {
  return workItemStarters({ board: triageWorkBoard, cards, failedCardIds: new Set(failedCardIds), now: NOW });
}

const NOTHING = {
  failed: 0,
  changesRequested: 0,
  review: { count: 0 },
  undecided: 0,
  untriaged: 0,
  unplannedBugs: 0,
  stale: 0,
};

describe('workItemStarters', () => {
  it('counts nothing when no card waits on anyone', () => {
    expect(
      count([
        card('shipped', { stages: ['done'] }),
        card('canceled', { stages: ['canceled'] }),
        triaged('building', { stages: ['execute'], sessions: { triage: TRIAGE_RUN, work: TRIAGE_RUN } }),
        pullRequest(9, ['done'], { merged: true }),
      ]),
    ).toEqual(NOTHING);
  });

  it('counts nothing for a project without the default board', () => {
    expect(workItemStarters({ board: undefined, cards: [card('new')], failedCardIds: new Set(), now: NOW })).toEqual(
      NOTHING,
    );
  });

  it('reads a synced card’s labels and a pull request’s opening date from its source, not from the card', () => {
    const bugs = ['one', 'two', 'three'].map(id =>
      synced(id, ['bug', 'Memory'], { metadata: { labels: ['documentation', 'stale-area'] } }),
    );
    const recent = pullRequest(73, ['intake'], { sourceCreatedAt: daysAgo(2) });
    recent.metadata = { sourceCreatedAt: daysAgo(60) };

    expect(count(bugs)).toMatchObject({ unplannedBugs: 3, sweep: { area: 'Memory', count: 3 } });
    expect(count([recent])).toMatchObject({ review: { count: 1, oldestOpenedAt: daysAgo(2) }, stale: 0 });
  });

  it('counts the pull requests waiting in Intake and when the oldest opened, leaving out drafts, finished ones and those in review', () => {
    const { review } = count([
      pullRequest(2, ['intake'], { sourceCreatedAt: daysAgo(1) }),
      pullRequest(1, ['intake'], { sourceCreatedAt: daysAgo(10) }),
      pullRequest(3, ['intake'], { draft: true }),
      pullRequest(4, ['done'], { merged: true }),
      pullRequest(5, ['canceled'], { state: 'closed' }),
      pullRequest(7, ['done'], { state: null }),
      pullRequest(6, ['pr-review']),
    ]);

    expect(review).toEqual({ count: 2, oldestOpenedAt: daysAgo(10) });
  });

  it('dates a pull request whose source reports no opening date from its card', () => {
    const { review } = count([{ ...pullRequest(1, ['intake']), createdAt: new Date(daysAgo(4)) }]);

    expect(review).toEqual({ count: 1, oldestOpenedAt: daysAgo(4) });
  });

  it('counts pull requests open over a month as stale instead of waiting for review', () => {
    const starters = count([
      pullRequest(1, ['intake'], { sourceCreatedAt: daysAgo(31) }),
      pullRequest(2, ['intake'], { sourceCreatedAt: daysAgo(90) }),
      pullRequest(3, ['intake'], { sourceCreatedAt: daysAgo(29) }),
      pullRequest(4, ['intake'], { sourceCreatedAt: daysAgo(60), draft: true }),
    ]);

    expect(starters.stale).toBe(2);
    expect(starters.review).toEqual({ count: 1, oldestOpenedAt: daysAgo(29) });
  });

  it('counts the cards triage left in Intake for a decision, leaving out work still triaging or started', () => {
    const starters = count([
      triaged('question'),
      triaged('feature'),
      triaged('triaging', { stages: ['triage'] }),
      card('untriaged'),
      triaged('building', { stages: ['execute'] }),
      triaged('parked', {
        sessions: { triage: TRIAGE_RUN, work: TRIAGE_RUN },
        stageHistory: [
          { stage: 'triage', enteredAt: daysAgo(3), by: 'u1' },
          { stage: 'execute', enteredAt: daysAgo(2), by: 'u1' },
          { stage: 'intake', enteredAt: daysAgo(1), by: 'u1' },
        ],
      }),
    ]);

    expect(starters.undecided).toBe(2);
    expect(starters.untriaged).toBe(1);
  });

  it('counts every card in Intake that triage has not looked at, a card in no known phase among them', () => {
    const starters = count([
      ...Array.from({ length: 7 }, (_, index) => card(`intake-${index}`)),
      card('lost', { stages: ['retired-phase'] }),
      triaged('held-question'),
    ]);

    expect(starters.untriaged).toBe(8);
  });

  it('counts pull request cards as pull requests, not as untriaged intake', () => {
    const starters = count([
      pullRequest(1, ['intake'], { sourceCreatedAt: daysAgo(3) }),
      pullRequest(2, ['pr-review'], {}, { factoryAuthored: true, reviewVerdict: 'request changes' }),
    ]);

    expect(starters).toMatchObject({ review: { count: 1 }, changesRequested: 1, untriaged: 0, undecided: 0 });
  });

  it('leaves the cards of other boards out of everything but failed runs', () => {
    const starters = count(
      [
        card('other-intake', { board: 'release', metadata: { labels: ['bug', 'Memory'] } }),
        { ...pullRequest(1, ['intake']), board: 'release' },
        card('other-failed', { board: 'release', stages: ['preparing'] }),
      ],
      ['other-failed'],
    );

    expect(starters).toEqual({ ...NOTHING, failed: 1 });
  });

  it('names the area label most cards not started carry, ignoring process labels and GitHub type labels', () => {
    const labelled = (id: string, labels: string[], overrides: Partial<Card> = {}) =>
      card(id, { metadata: { labels }, ...overrides });

    const { sweep } = count([
      ...['leak', 'recall', 'threads'].map(id => labelled(id, ['Memory', 'enhancement', 'p: high'])),
      labelled('agents-1', ['Agents', 'enhancement', 'p: high']),
      labelled('agents-2', ['Agents', 'enhancement', 'status: needs triage'], { stages: ['triage'] }),
      labelled('feature', ['enhancement', 'status: needs triage']),
      ...['a', 'b', 'c'].map(id => labelled(`agents-done-${id}`, ['Agents'], { stages: ['done'] })),
    ]);

    expect(sweep).toEqual({ area: 'Memory', count: 3 });
  });

  it('names the first area by name when two tie, and none when no card carries an area', () => {
    expect(
      count([card('b', { metadata: { labels: ['Tools'] } }), card('a', { metadata: { labels: ['Agents'] } })]).sweep,
    ).toEqual({ area: 'Agents', count: 1 });
    expect(count([card('plain', { metadata: { labels: ['bug'] } })]).sweep).toBeUndefined();
  });

  it('counts only the bugs nobody has planned or started', () => {
    const starters = count([
      card('triaging-bug', { stages: ['triage'], metadata: { labels: ['bug'] } }),
      card('labelled-bug', { metadata: { labels: ['Bug'] } }),
      card('planned-bug', { stages: ['triage'], metadata: { labels: ['bug'] }, sessions: { plan: TRIAGE_RUN } }),
      card('claimed-bug', { metadata: { labels: ['bug'] }, sessions: { work: TRIAGE_RUN } }),
      card('building-bug', { stages: ['execute'], metadata: { labels: ['bug'] } }),
      triaged('feature'),
    ]);

    expect(starters.unplannedBugs).toBe(2);
  });

  it('counts the open cards whose run failed, on any board', () => {
    const starters = count(
      [
        card('failed', { stages: ['execute'] }),
        card('queued', { stages: ['execute'] }),
        card('failed-then-shipped', { stages: ['done'] }),
      ],
      ['failed', 'failed-then-shipped'],
    );

    expect(starters.failed).toBe(1);
  });

  it('counts review feedback only on open Factory pull requests whose verdict is still current', () => {
    const starters = count([
      pullRequest(
        1,
        ['pr-review'],
        {},
        { factoryAuthored: true, reviewVerdict: 'request changes', reviewedHeadSha: 'abc', pullRequestHeadSha: 'ABC' },
      ),
      pullRequest(2, ['pr-review'], {}, { reviewVerdict: 'request changes' }),
      pullRequest(
        3,
        ['pr-review'],
        {},
        { factoryAuthored: true, reviewVerdict: 'request changes', reviewedHeadSha: 'abc', pullRequestHeadSha: 'def' },
      ),
      pullRequest(4, ['pr-review'], {}, { factoryAuthored: true, reviewVerdict: 'approve' }),
      pullRequest(5, ['done'], { merged: true }, { factoryAuthored: true, reviewVerdict: 'request changes' }),
      pullRequest(6, ['pr-review'], { draft: true }, { factoryAuthored: true, reviewVerdict: 'request changes' }),
    ]);

    expect(starters.changesRequested).toBe(1);
  });

  it('reads a pull request whose source reports no state as finished once it sits in a terminal phase', () => {
    const stateless = (id: string, stage: string) =>
      card(id, {
        stages: [stage],
        externalSource: { integrationId: 'github', type: 'pull-request', externalId: id },
        metadata: { factoryAuthored: true, reviewVerdict: 'request changes' },
      });

    const starters = count([stateless('1', 'pr-review'), stateless('2', 'done'), stateless('3', 'canceled')]);

    expect(starters.changesRequested).toBe(1);
  });

  it('asks about triage only on a board that triages', () => {
    const work = createBoardRegistry().get('work');

    const starters = workItemStarters({
      board: work,
      cards: [card('new', { metadata: { labels: ['bug'] } }), triaged('old')],
      failedCardIds: new Set(),
      now: NOW,
    });

    expect(starters).toMatchObject({ untriaged: 0, undecided: 0, unplannedBugs: 1 });
  });
});

describe('cardsWithFailedRun', () => {
  it('reads each card’s run state from its newest decision, skipping proposals', () => {
    const failed = cardsWithFailedRun([
      { workItemId: 'retried', status: 'pending' },
      { workItemId: 'retried', status: 'failed' },
      { workItemId: 'proposed-after-failing', status: 'proposed' },
      { workItemId: 'proposed-after-failing', status: 'failed' },
      { workItemId: 'failed', status: 'failed' },
    ]);

    expect([...failed].toSorted()).toEqual(['failed', 'proposed-after-failing']);
  });
});
