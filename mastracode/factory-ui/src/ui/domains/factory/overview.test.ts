import { describe, expect, it } from 'vitest';

import type { WorkItem, WorkItemStageEntry } from './services/workItems';
import { computeFactoryOverview } from './overview';

const NOW = new Date('2026-07-17T12:00:00.000Z');
const WINDOW = { fromMs: Date.parse('2026-07-10T00:00:00.000Z'), toMs: NOW.getTime() };
const NO_SESSIONS: ReadonlySet<string> = new Set();

const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000).toISOString();

let nextId = 0;
function makeItem(overrides: Partial<WorkItem> = {}): WorkItem {
  nextId += 1;
  return {
    id: `item-${nextId}`,
    orgId: 'org1',
    createdBy: 'u1',
    githubProjectId: 'proj1',
    parentWorkItemId: null,
    source: 'github-issue',
    sourceKey: null,
    title: `Item ${nextId}`,
    url: null,
    stages: ['execute'],
    stageHistory: [],
    sessions: { work: { sessionId: `session-${nextId}`, branch: 'b', threadId: 't', startedBy: 'u1' } },
    metadata: {},
    commentCount: 0,
    feedActivityAt: null,
    revision: 1,
    createdAt: hoursAgo(30),
    updatedAt: hoursAgo(1),
    ...overrides,
  };
}

/** Item that reached `done` `completedHoursAgo` ago, through the given passes. */
function shipped(passes: WorkItemStageEntry[], completedHoursAgo = 2, overrides: Partial<WorkItem> = {}): WorkItem {
  return makeItem({
    stages: ['done'],
    stageHistory: [...passes, { stage: 'done', enteredAt: hoursAgo(completedHoursAgo), by: 'agent:builder' }],
    ...overrides,
  });
}

const pass = (stage: string, fromHoursAgo: number, toHoursAgo: number, exitedBy: string): WorkItemStageEntry => ({
  stage,
  enteredAt: hoursAgo(fromHoursAgo),
  exitedAt: hoursAgo(toHoursAgo),
  by: 'factory-rule-dispatcher',
  exitedBy,
});

describe('computeFactoryOverview', () => {
  it('ignores cards the Factory never ran', () => {
    const synced = makeItem({ sessions: {}, stages: ['execute'] });
    const overview = computeFactoryOverview([synced], NO_SESSIONS, WINDOW, NOW);

    expect(overview.inFlight).toBe(0);
    expect(overview.waiting).toHaveLength(0);
  });

  it('counts an item as unattended only when every pass was closed by an agent', () => {
    const byAgents = shipped([pass('execute', 6, 4, 'agent:builder'), pass('review', 4, 2, 'agent:reviewer')]);
    const humanTouched = shipped([pass('execute', 6, 4, 'agent:builder'), pass('review', 4, 2, 'u1')]);

    const overview = computeFactoryOverview([byAgents, humanTouched], NO_SESSIONS, WINDOW, NOW);

    expect(overview.funnel[0]).toMatchObject({ reached: 2, unattended: 1 });
  });

  it('counts a rule that closed a pass as unattended — nobody was asked to act', () => {
    const byRules = shipped([pass('execute', 6, 4, 'factory-rule-dispatcher'), pass('review', 4, 2, 'agent:reviewer')]);
    const byGithub = shipped([pass('execute', 6, 4, 'agent:builder'), pass('review', 4, 2, 'github:someone')]);

    const overview = computeFactoryOverview([byRules, byGithub], NO_SESSIONS, WINDOW, NOW);

    expect(overview.funnel[0]).toMatchObject({ reached: 2, unattended: 1 });
  });

  it('reads a pass with no exit actor as human — pre-stamping history must not inflate autonomy', () => {
    const unstamped = shipped([{ stage: 'execute', enteredAt: hoursAgo(6), exitedAt: hoursAgo(4), by: 'u1' }]);

    expect(computeFactoryOverview([unstamped], NO_SESSIONS, WINDOW, NOW).funnel[0]!.unattended).toBe(0);
  });

  it('lists unattended pipeline items oldest first and leaves running ones out', () => {
    const stale = makeItem({ stageHistory: [{ stage: 'execute', enteredAt: hoursAgo(20), by: 'u1' }] });
    const fresh = makeItem({
      stageHistory: [{ stage: 'review', enteredAt: hoursAgo(3), by: 'u1' }],
      stages: ['review'],
    });
    const busy = makeItem({
      stageHistory: [{ stage: 'execute', enteredAt: hoursAgo(9), by: 'u1' }],
      sessions: { work: { sessionId: 'live', branch: 'b', threadId: 't', startedBy: 'u1' } },
    });

    const overview = computeFactoryOverview([fresh, stale, busy], new Set(['live']), WINDOW, NOW);

    expect(overview.waiting.map(entry => entry.id)).toEqual([stale.id, fresh.id]);
    expect(overview.running.map(entry => entry.id)).toEqual([busy.id]);
    expect(overview.inFlight).toBe(3);
  });

  it('lists stage changes inside the window newest first, with the actor that made them', () => {
    const item = makeItem({
      stageHistory: [
        { stage: 'execute', enteredAt: hoursAgo(5), by: 'factory-rule-dispatcher' },
        { stage: 'review', enteredAt: hoursAgo(2), by: 'agent:builder' },
        { stage: 'execute', enteredAt: hoursAgo(400), by: 'u1' },
      ],
    });

    const { moved } = computeFactoryOverview([item], NO_SESSIONS, WINDOW, NOW);

    expect(moved.map(entry => [entry.stage, entry.by])).toEqual([
      ['review', 'agent:builder'],
      ['execute', 'factory-rule-dispatcher'],
    ]);
  });

  it('counts an item at every rung it reached or passed, and none beyond', () => {
    const reachedReview = makeItem({
      stages: ['review'],
      stageHistory: [
        { stage: 'triage', enteredAt: hoursAgo(20), by: 'u1' },
        { stage: 'review', enteredAt: hoursAgo(4), by: 'agent:builder' },
      ],
    });
    const overview = computeFactoryOverview([reachedReview], NO_SESSIONS, WINDOW, NOW);
    const reach = Object.fromEntries(overview.funnel.map(step => [step.stage, step.reached]));

    expect(reach).toEqual({ intake: 1, triage: 1, planning: 1, execute: 1, review: 1, done: 0 });
  });

  it('counts where a card stands even when its stage history says nothing', () => {
    const overview = computeFactoryOverview(
      [makeItem({ stages: ['review'], stageHistory: [] })],
      NO_SESSIONS,
      WINDOW,
      NOW,
    );
    const reach = Object.fromEntries(overview.funnel.map(step => [step.stage, step.reached]));

    expect(reach).toEqual({ intake: 1, triage: 1, planning: 1, execute: 1, review: 1, done: 0 });
  });

  it('reads a stage the board does not know as no progress at all', () => {
    const custom = makeItem({
      stages: ['needs-legal'],
      stageHistory: [
        { stage: 'triage', enteredAt: hoursAgo(20), by: 'u1' },
        { stage: 'needs-legal', enteredAt: hoursAgo(4), by: 'u1' },
      ],
    });
    const overview = computeFactoryOverview([custom], NO_SESSIONS, WINDOW, NOW);
    const reach = Object.fromEntries(overview.funnel.map(step => [step.stage, step.reached]));

    expect(reach).toEqual({ intake: 1, triage: 1, planning: 0, execute: 0, review: 0, done: 0 });
  });

  it('keeps PR cards out of the funnel and counts them beside it', () => {
    const reviewCard = makeItem({
      source: 'github-pr',
      stages: ['done'],
      stageHistory: [
        { stage: 'review', enteredAt: hoursAgo(20), by: 'agent:reviewer' },
        { stage: 'done', enteredAt: hoursAgo(4), by: 'agent:reviewer' },
      ],
    });
    const overview = computeFactoryOverview([reviewCard], NO_SESSIONS, WINDOW, NOW);
    const reach = Object.fromEntries(overview.funnel.map(step => [step.stage, step.reached]));

    expect(reach).toEqual({ intake: 0, triage: 0, planning: 0, execute: 0, review: 0, done: 0 });
  });

  it('hatches the cohort work that opened a pull request, without adding it to the flow', () => {
    const built = makeItem({
      stageHistory: [
        { stage: 'intake', enteredAt: hoursAgo(30), by: 'u1' },
        { stage: 'done', enteredAt: hoursAgo(4), by: 'agent:builder' },
      ],
    });
    const pr = makeItem({
      source: 'github-pr',
      parentWorkItemId: built.id,
      stageHistory: [
        { stage: 'intake', enteredAt: hoursAgo(10), by: 'github:someone' },
        { stage: 'done', enteredAt: hoursAgo(3), by: 'github:someone' },
      ],
    });

    const overview = computeFactoryOverview([built, pr], NO_SESSIONS, WINDOW, NOW);

    expect(overview.pullRequests).toBe(1);
    expect(overview.funnel[0]?.reached).toBe(1);
  });

  it('counts a merged PR once, not twice through its own Review card', () => {
    const authoring = makeItem({
      stages: ['done'],
      stageHistory: [
        { stage: 'execute', enteredAt: hoursAgo(20), by: 'agent:builder' },
        { stage: 'done', enteredAt: hoursAgo(4), by: 'agent:builder' },
      ],
    });
    const itsReviewCard = makeItem({
      source: 'github-pr',
      parentWorkItemId: authoring.id,
      stages: ['done'],
      stageHistory: [
        { stage: 'review', enteredAt: hoursAgo(10), by: 'agent:reviewer' },
        { stage: 'done', enteredAt: hoursAgo(4), by: 'agent:reviewer' },
      ],
    });
    const overview = computeFactoryOverview([authoring, itsReviewCard], NO_SESSIONS, WINDOW, NOW);

    expect(overview.funnel[0]?.reached).toBe(1);
    expect(overview.funnel.at(-1)?.reached).toBe(1);
  });

  it('splits a rung by who had to close it, so the flow can draw its hands-off core', () => {
    const untouched = makeItem({
      stages: ['review'],
      stageHistory: [pass('execute', 20, 6, 'agent:builder'), { stage: 'review', enteredAt: hoursAgo(6), by: 'a' }],
    });
    const needed = makeItem({
      stages: ['review'],
      stageHistory: [pass('execute', 20, 6, 'u1'), { stage: 'review', enteredAt: hoursAgo(6), by: 'u1' }],
    });
    const overview = computeFactoryOverview([untouched, needed], NO_SESSIONS, WINDOW, NOW);
    const review = overview.funnel.find(step => step.stage === 'review');

    expect(review).toMatchObject({ reached: 2, unattended: 1 });
  });

  it('reads the median hold off closed passes, not off the cards still sitting there', () => {
    const quick = makeItem({ stages: ['review'], stageHistory: [pass('execute', 20, 18, 'agent:builder')] });
    const slow = makeItem({ stages: ['review'], stageHistory: [pass('execute', 20, 10, 'agent:builder')] });
    const stillThere = makeItem({
      stages: ['execute'],
      stageHistory: [{ stage: 'execute', enteredAt: hoursAgo(30), by: 'agent:builder' }],
    });
    const overview = computeFactoryOverview([quick, slow, stillThere], NO_SESSIONS, WINDOW, NOW);

    expect(overview.funnel.find(step => step.stage === 'execute')?.medianHoldMs).toBe(6 * 3_600_000);
  });

  it('tells a called-off drop from one that is still moving', () => {
    const canceled = makeItem({
      stages: ['canceled'],
      stageHistory: [
        { stage: 'triage', enteredAt: hoursAgo(20), by: 'u1' },
        { stage: 'canceled', enteredAt: hoursAgo(4), by: 'u1' },
      ],
    });
    const stillInTriage = makeItem({
      stages: ['triage'],
      stageHistory: [{ stage: 'triage', enteredAt: hoursAgo(20), by: 'u1' }],
    });
    const overview = computeFactoryOverview([canceled, stillInTriage], NO_SESSIONS, WINDOW, NOW);

    expect(overview.funnel.find(step => step.stage === 'triage')).toMatchObject({
      restingAt: 2,
      canceled: 1,
      open: 1,
    });
  });

  it('counts a cohort PR as merged only once it reaches Done', () => {
    const built = makeItem({
      stageHistory: [{ stage: 'intake', enteredAt: hoursAgo(30), by: 'u1' }],
    });
    const openPr = makeItem({
      source: 'github-pr',
      parentWorkItemId: built.id,
      stages: ['review'],
      stageHistory: [{ stage: 'review', enteredAt: hoursAgo(10), by: 'github:someone' }],
    });
    const landedPr = makeItem({
      source: 'github-pr',
      parentWorkItemId: built.id,
      stages: ['done'],
      stageHistory: [
        { stage: 'review', enteredAt: hoursAgo(10), by: 'github:someone' },
        { stage: 'done', enteredAt: hoursAgo(3), by: 'github:someone' },
      ],
    });

    const overview = computeFactoryOverview([built, openPr, landedPr], NO_SESSIONS, WINDOW, NOW);

    expect(overview.pullRequests).toBe(2);
    expect(overview.merged).toBe(1);
  });

  it('rests an item on its furthest column, so the loss is attributable', () => {
    const stuckInTriage = makeItem({
      stages: ['triage'],
      stageHistory: [{ stage: 'triage', enteredAt: hoursAgo(20), by: 'u1' }],
    });
    const stuckInReview = makeItem({
      stages: ['review'],
      stageHistory: [
        { stage: 'triage', enteredAt: hoursAgo(20), by: 'u1' },
        { stage: 'review', enteredAt: hoursAgo(6), by: 'agent:builder' },
      ],
    });
    const overview = computeFactoryOverview([stuckInTriage, stuckInReview], NO_SESSIONS, WINDOW, NOW);
    const resting = Object.fromEntries(overview.funnel.map(step => [step.stage, step.restingAt]));

    expect(resting).toEqual({ intake: 0, triage: 1, planning: 0, execute: 0, review: 1, done: 0 });
  });

  it('treats a cancel as a drop, not as reaching Done', () => {
    const canceled = makeItem({
      stages: ['canceled'],
      stageHistory: [
        { stage: 'triage', enteredAt: hoursAgo(20), by: 'u1' },
        { stage: 'canceled', enteredAt: hoursAgo(4), by: 'u1' },
      ],
    });
    const overview = computeFactoryOverview([canceled], NO_SESSIONS, WINDOW, NOW);
    const reach = Object.fromEntries(overview.funnel.map(step => [step.stage, step.reached]));

    expect(reach).toMatchObject({ triage: 1, planning: 0, done: 0 });
  });

  it('funnels one cohort — work created before the window is not new', () => {
    const older = shipped([pass('execute', 400, 380, 'agent:builder')], 370, {
      createdAt: hoursAgo(500),
    });
    const overview = computeFactoryOverview([older], NO_SESSIONS, WINDOW, NOW);

    expect(overview.funnel.every(step => step.reached === 0)).toBe(true);
  });

  it('starts the timeline at the first card when the Factory is younger than the window', () => {
    const created = hoursAgo(24);
    const { timeline } = computeFactoryOverview([makeItem({ createdAt: created })], NO_SESSIONS, WINDOW, NOW);

    expect(timeline).toEqual({ fromMs: Date.parse(created), toMs: WINDOW.toMs });
  });

  it('keeps the window start when the Factory predates it', () => {
    const older = makeItem({ createdAt: hoursAgo(24 * 30) });

    expect(computeFactoryOverview([older], NO_SESSIONS, WINDOW, NOW).timeline).toEqual(WINDOW);
  });
});
