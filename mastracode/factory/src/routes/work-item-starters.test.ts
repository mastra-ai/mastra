import { describe, expect, it } from 'vitest';

import type { WorkItemRow } from '../storage/domains/work-items/base.js';
import { workItemStarters } from './work-item-starters.js';

const NOW = new Date('2030-06-01T00:00:00.000Z');
const DAY_MS = 24 * 60 * 60 * 1000;

let next = 0;
function card(overrides: Partial<WorkItemRow> = {}): WorkItemRow {
  next += 1;
  return {
    id: `item-${next}`,
    orgId: 'org1',
    factoryProjectId: 'fp',
    board: 'work',
    externalSource: null,
    claimKey: null,
    parentWorkItemId: null,
    title: `Card ${next}`,
    stages: ['intake'],
    stageHistory: [],
    sessions: {},
    metadata: {},
    triageType: null,
    autonomyArmedAt: null,
    plansPreapprovedAt: null,
    acceptedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  } as WorkItemRow;
}

const TRIAGE_RUN = { sessionId: 's-triage', branch: 'b', threadId: 't' };
const PR_SOURCE = { type: 'pull-request' } as WorkItemRow['externalSource'];

function pullRequest(daysOpen: number, metadata: Record<string, unknown> = {}, board = 'review'): WorkItemRow {
  return card({
    board,
    externalSource: PR_SOURCE,
    metadata: { sourceCreatedAt: new Date(NOW.getTime() - daysOpen * DAY_MS).toISOString(), ...metadata },
  });
}

describe('workItemStarters', () => {
  it('counts nothing on an empty project', () => {
    expect(workItemStarters([], new Set(), NOW)).toEqual({
      failed: 0,
      changesRequested: 0,
      review: { count: 0 },
      undecided: 0,
      untriaged: 0,
      unplannedBugs: 0,
      stale: 0,
    });
  });

  it('counts failed runs only on open cards', () => {
    const open = card({ stages: ['execute'] });
    const shipped = card({ stages: ['done'] });
    expect(workItemStarters([open, shipped], new Set([open.id, shipped.id]), NOW).failed).toBe(1);
  });

  it('splits waiting pull requests into recent and stale, and finds the oldest recent one', () => {
    const starters = workItemStarters(
      [
        pullRequest(3),
        pullRequest(10),
        pullRequest(45),
        pullRequest(5, { draft: true }),
        pullRequest(2, { merged: true }),
        pullRequest(4, {}, 'work'),
      ],
      new Set(),
      NOW,
    );
    expect(starters.review).toEqual({ count: 3, oldestOpenedAt: new Date(NOW.getTime() - 10 * DAY_MS).toISOString() });
    expect(starters.stale).toBe(1);
  });

  it('leaves pull requests that moved past Intake out of review', () => {
    const reviewing = card({ board: 'review', externalSource: PR_SOURCE, stages: ['review'] });
    const prReview = card({ externalSource: PR_SOURCE, stages: ['pr-review'] });
    expect(workItemStarters([reviewing, prReview], new Set(), NOW).review.count).toBe(0);
  });

  it("counts changes requested only on Factory's pull requests at the reviewed head", () => {
    const verdict = { factoryAuthored: true, reviewVerdict: 'request changes' };
    const starters = workItemStarters(
      [
        pullRequest(1, { ...verdict, reviewedHeadSha: 'abc', pullRequestHeadSha: 'ABC' }),
        pullRequest(1, { ...verdict, reviewedHeadSha: 'abc', pullRequestHeadSha: 'def' }),
        pullRequest(1, { ...verdict, factoryAuthored: false }),
        pullRequest(1, { factoryAuthored: true, reviewVerdict: 'approve' }),
        pullRequest(1, { ...verdict, reviewedHeadSha: 'abc', pullRequestHeadSha: 'abc' }, 'work'),
      ],
      new Set(),
      NOW,
    );
    expect(starters.changesRequested).toBe(2);
  });

  it('counts untriaged Intake cards, cards triage left for a decision and unplanned bugs', () => {
    const triaged = (overrides: Partial<WorkItemRow> = {}) => card({ sessions: { triage: TRIAGE_RUN }, ...overrides });
    const starters = workItemStarters(
      [
        card(),
        card({ board: null, stages: [] }),
        card({ externalSource: PR_SOURCE }),
        triaged(),
        triaged({ triageType: 'bug' }),
        triaged({ stages: ['triage'] }),
        triaged({ stages: ['execute'] }),
        triaged({
          stageHistory: [
            { stage: 'triage', enteredAt: NOW, by: 'u' },
            { stage: 'execute', enteredAt: NOW, by: 'u' },
            { stage: 'intake', enteredAt: NOW, by: 'u' },
          ],
        } as Partial<WorkItemRow>),
        card({ metadata: { labels: ['Bug'] } }),
        card({ metadata: { labels: ['bug'] }, sessions: { plan: { sessionId: 's', branch: 'b', threadId: 't' } } }),
        card({ stages: ['execute'], metadata: { labels: ['bug'] } }),
      ] as WorkItemRow[],
      new Set(),
      NOW,
    );
    expect(starters.untriaged).toBe(4);
    expect(starters.undecided).toBe(2);
    expect(starters.unplannedBugs).toBe(1);
  });

  it('suggests a sweep of the largest area once it has enough cards not started', () => {
    const memory = () => card({ metadata: { labels: ['Memory', 'bug', 'priority:high'] } });
    const tools = () => card({ metadata: { labels: ['Tools'] } });
    expect(workItemStarters([memory(), memory(), tools()], new Set(), NOW).sweep).toBeUndefined();
    expect(workItemStarters([memory(), memory(), memory(), tools()], new Set(), NOW).sweep).toEqual({
      area: 'Memory',
      count: 3,
    });
  });

  it('leaves closed pull requests and started or finished cards out of the sweep, decisions and review', () => {
    const agents = (stages: string[]) => card({ stages, metadata: { labels: ['Agents'] } });
    const starters = workItemStarters(
      [
        agents(['done']),
        agents(['canceled']),
        agents(['execute']),
        card({ stages: ['execute'], sessions: { triage: TRIAGE_RUN } }),
        pullRequest(1, { state: 'closed' }),
        card({ board: 'review', stages: ['canceled'], metadata: { sourceCreatedAt: NOW.toISOString() } }),
      ],
      new Set(),
      NOW,
    );
    expect(starters.sweep).toBeUndefined();
    expect(starters.undecided).toBe(0);
    expect(starters.review.count).toBe(0);
  });
});
