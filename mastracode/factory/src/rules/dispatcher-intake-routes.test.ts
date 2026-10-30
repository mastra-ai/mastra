import { describe, expect, it } from 'vitest';

import { createBoardRegistry } from '../boards/index.js';
import { ProjectBoardCache } from '../boards/project-boards.js';
import type { StoredIntakeRouteInput } from '../storage/domains/boards/base.js';
import { createFactoryStorageForTests } from '../storage/test-utils.js';
import { FactoryDecisionDispatcher } from './dispatcher.js';
import { FactoryTransitionService } from './transition-service.js';
import type { FactoryCommitDecision } from './types.js';

type LinkedDecision = Extract<FactoryCommitDecision, { type: 'upsertLinkedWorkItem' }>;

const TRUSTED = {
  operator: 'AND',
  conditions: [{ field: 'author.trusted', operator: 'equals', value: true }],
} as const;
const DOCS = { operator: 'AND', conditions: [{ field: 'item.labels', operator: 'contains', value: 'docs' }] } as const;

const docsBoard = {
  key: 'docs',
  name: 'Docs',
  phases: [
    { key: 'inbox', name: 'Inbox', kind: 'resting' as const, nextPhases: ['writing'] },
    {
      key: 'writing',
      name: 'Writing',
      kind: 'working' as const,
      runner: { context: 'work' },
      nextPhases: ['published'],
    },
    { key: 'published', name: 'Published', kind: 'terminal' as const },
  ],
};

/** A real dispatcher over real storage, with the project's stored boards and intake routes. */
async function setup(options: { withRoutesReader?: boolean; autoRun?: boolean } = {}) {
  const seeded = await createFactoryStorageForTests();
  const project = await seeded.projects.create({ orgId: 'org-1', userId: 'user-1', input: { name: 'Routes' } });
  const scope = { orgId: 'org-1', factoryProjectId: project.id };
  const boards = new ProjectBoardCache({ codeRegistry: createBoardRegistry(), storage: seeded.boards, recheckMs: 0 });
  const configVersion = 'intake-routes-v1';
  const workItems = seeded.workItems;
  const dispatcher = new FactoryDecisionDispatcher({
    controller: {} as never,
    transitionService: new FactoryTransitionService({
      storage: workItems,
      configVersion,
      boards,
      ...(options.withRoutesReader === false ? {} : { intakeRoutes: seeded.boards }),
    }),
    storage: workItems,
    boards,
    ...(options.withRoutesReader === false ? {} : { intakeRoutes: seeded.boards }),
    // Off unless a test asks: keeps any run a phase proposes parked, so most tests only see placement.
    isAutoRunEnabled: async () => options.autoRun === true,
    ownerId: 'worker-routes',
  });
  let deliveries = 0;
  const route = (input: StoredIntakeRouteInput) => seeded.boards.createIntakeRoute(scope, input, 'admin');
  /** Commits one linked-card decision, as an integration's rules would, and lets the dispatcher apply it. */
  const deliver = async (
    decision: Partial<LinkedDecision> & { sourceKey: string },
    workItemId: string | null = null,
  ) => {
    deliveries += 1;
    await workItems.commitRuleEvaluation({
      ...scope,
      workItemId,
      ingress: { identity: `delivery-${deliveries}`, triggerType: 'issues.opened' },
      configVersion,
      expectedRevision: workItemId
        ? ((await workItems.get({ orgId: 'org-1', id: workItemId }))?.revision ?? null)
        : null,
      actor: { type: 'system', id: 'rules' },
      outcome: { status: 'accepted' },
      decisions: [
        {
          type: 'upsertLinkedWorkItem',
          idempotencyKey: `linked-${deliveries}`,
          board: 'work',
          source: 'github-issue',
          title: `Issue ${decision.sourceKey}`,
          stage: 'intake',
          url: `https://example.com/${decision.sourceKey}`,
          metadata: {},
          ...decision,
        } as LinkedDecision,
      ],
      causalChain: [],
      now: new Date('2030-01-01T00:00:00Z'),
    });
    await dispatcher.runOnce(new Date(`2030-01-01T00:00:${String(deliveries).padStart(2, '0')}Z`));
    const card = (await workItems.list(scope)).find(item => item.externalSource?.externalId === decision.sourceKey);
    return card;
  };
  /** The runs the card's phases asked for, after the dispatcher had a turn at them. */
  const runs = async (cardId: string) => {
    await dispatcher.runOnce(new Date('2030-01-01T00:01:00Z'));
    return (await workItems.listDeferredDecisions('org-1', project.id))
      .filter(decision => decision.workItemId === cardId && decision.decision.type === 'invokeSkill')
      .map(decision => decision.status);
  };
  const runErrors = async (cardId: string) =>
    (await workItems.listDeferredDecisions('org-1', project.id))
      .filter(decision => decision.workItemId === cardId && decision.decision.type === 'invokeSkill')
      .map(decision => decision.lastError);
  return { ...seeded, scope, project, route, deliver, runs, runErrors };
}

function placed(card: { board?: string | null; stages: string[] } | undefined) {
  return card && { board: card.board ?? 'work', stages: card.stages };
}

describe('intake routes placing linked cards', () => {
  it('leaves every arrival where its decision says when the project has no routes', async () => {
    const { deliver } = await setup();
    expect(placed(await deliver({ sourceKey: 'github-issue:1', metadata: { authorTrusted: true } }))).toEqual({
      board: 'work',
      stages: ['intake'],
    });
    expect(placed(await deliver({ sourceKey: 'github-issue:2', metadata: { labels: ['docs'] } }))).toEqual({
      board: 'work',
      stages: ['intake'],
    });
  });

  it("sends a trusted author's issue through Intake to Triage and leaves an untrusted one in Intake", async () => {
    const { route, deliver } = await setup();
    const toTriage = await route({
      name: 'Trusted to triage',
      when: TRUSTED,
      target: { boardKey: 'work', phaseKey: 'triage' },
    });

    const trusted = await deliver({ sourceKey: 'github-issue:1', metadata: { authorTrusted: true } });
    expect(placed(trusted)).toEqual({ board: 'work', stages: ['triage'] });
    // The card remembers the route, so label routes and replays leave it where the route put it.
    expect(trusted?.metadata).toMatchObject({ intakeRouteId: toTriage.id });
    // Entered through the board's initial phase, then moved by a recorded transition.
    expect(trusted?.stageHistory.map(entry => entry.stage)).toEqual(['intake', 'triage']);

    const untrusted = await deliver({ sourceKey: 'github-issue:2', metadata: { authorTrusted: false } });
    expect(placed(untrusted)).toEqual({ board: 'work', stages: ['intake'] });
    expect(untrusted?.metadata).not.toHaveProperty('intakeRouteId');
  });

  it("doesn't start an outsider's card a route sends into a working phase, even with auto-run on", async () => {
    const { route, deliver, runs } = await setup({ autoRun: true });
    await route({ name: 'Everything to triage', when: null, target: { boardKey: 'work', phaseKey: 'triage' } });

    const outsider = await deliver({ sourceKey: 'github-issue:1', metadata: { authorTrusted: false } });
    expect(placed(outsider)).toEqual({ board: 'work', stages: ['triage'] });
    expect(await runs(outsider!.id)).toEqual(['proposed']);

    const unstamped = await deliver({ sourceKey: 'github-issue:2', metadata: {} });
    expect(placed(unstamped)).toEqual({ board: 'work', stages: ['triage'] });
    expect(await runs(unstamped!.id)).toEqual(['proposed']);
  });

  it("starts an outsider's routed card only under a route that says hold: 'never'", async () => {
    const { route, deliver, runs, runErrors } = await setup({ autoRun: true });
    await route({
      name: 'Docs need no person',
      when: DOCS,
      target: { boardKey: 'work', phaseKey: 'triage' },
      hold: 'never',
    });

    const released = await deliver({
      sourceKey: 'github-issue:1',
      metadata: { authorTrusted: false, labels: ['docs'] },
    });
    expect(placed(released)).toEqual({ board: 'work', stages: ['triage'] });
    // Not held: the dispatcher tries to start it (and retries, as this harness has no sessions).
    expect(await runs(released!.id)).toEqual(['retry']);
    // It got past the hold and failed only for want of a session to run in.
    expect(await runErrors(released!.id)).toEqual(['No active Factory binding for role triage.']);
  });

  it('files a labelled issue on a stored board at its initial phase', async () => {
    const { boards, scope, route, deliver } = await setup();
    await boards.create(scope, docsBoard, 'admin');
    await route({ name: 'Docs', when: DOCS, target: { boardKey: 'docs' } });

    expect(placed(await deliver({ sourceKey: 'github-issue:1', metadata: { labels: ['Docs'] } }))).toEqual({
      board: 'docs',
      stages: ['inbox'],
    });
    expect(placed(await deliver({ sourceKey: 'github-issue:2', metadata: { labels: ['bug'] } }))).toEqual({
      board: 'work',
      stages: ['intake'],
    });
  });

  it('places GitLab merge requests and Linear issues by their integration', async () => {
    const { route, deliver } = await setup();
    await route({
      name: 'GitLab to triage',
      when: { operator: 'AND', conditions: [{ field: 'source.integration', operator: 'equals', value: 'gitlab' }] },
      target: { boardKey: 'work', phaseKey: 'triage' },
    });
    await route({
      name: 'Linear to planning',
      when: { operator: 'AND', conditions: [{ field: 'source.integration', operator: 'equals', value: 'linear' }] },
      target: { boardKey: 'work', phaseKey: 'planning' },
    });

    // The built-in Work board holds no pull requests, so the GitLab route skips Work for a merge
    // request; a route to Review places it.
    await route({
      name: 'GitLab reviews',
      when: { operator: 'AND', conditions: [{ field: 'source.integration', operator: 'equals', value: 'gitlab' }] },
      target: { boardKey: 'review', phaseKey: 'review' },
    });
    const mergeRequest = await deliver({
      sourceKey: 'gitlab-mr:5',
      source: 'gitlab-pr',
      board: 'review',
      metadata: { authorTrusted: true },
    });
    expect(placed(mergeRequest)).toEqual({ board: 'review', stages: ['review'] });
    expect(placed(await deliver({ sourceKey: 'gitlab-issue:6', source: 'gitlab-issue' }))).toEqual({
      board: 'work',
      stages: ['triage'],
    });
    expect(placed(await deliver({ sourceKey: 'linear-issue:ENG-1', source: 'linear-issue' }))).toEqual({
      board: 'work',
      stages: ['planning'],
    });
    expect(placed(await deliver({ sourceKey: 'github-issue:3', metadata: { authorTrusted: true } }))).toEqual({
      board: 'work',
      stages: ['intake'],
    });
  });

  it("does not re-route a decision that names a later phase, such as a maintainer's review request", async () => {
    const { boards, scope, route, deliver } = await setup();
    await boards.create(scope, docsBoard, 'admin');
    await route({ name: 'Everything to Docs', target: { boardKey: 'docs', phaseKey: 'writing' } });

    const requested = await deliver({
      sourceKey: 'github-pr:7',
      source: 'github-pr',
      board: 'review',
      stage: 'review',
      metadata: { authorTrusted: true },
    });
    expect(placed(requested)).toEqual({ board: 'review', stages: ['review'] });
    // The same route does place an arrival.
    const arrival = await deliver({ sourceKey: 'github-pr:8', source: 'github-pr', board: 'review' });
    expect(placed(arrival)).toEqual({ board: 'docs', stages: ['writing'] });
  });

  it('does not re-route a decision that places the card outright (skipRules)', async () => {
    const { route, deliver } = await setup();
    await route({ name: 'Everything to triage', target: { boardKey: 'work', phaseKey: 'triage' } });

    expect(
      placed(await deliver({ sourceKey: 'github-issue:1', board: 'review', stage: 'intake', skipRules: true })),
    ).toEqual({ board: 'review', stages: ['intake'] });
  });

  it('never moves a card that is already on the board when its source is re-emitted', async () => {
    const { route, deliver } = await setup();
    const card = await deliver({ sourceKey: 'github-issue:1', metadata: { authorTrusted: true } });
    expect(placed(card)).toEqual({ board: 'work', stages: ['intake'] });

    await route({ name: 'Trusted to triage', when: TRUSTED, target: { boardKey: 'work', phaseKey: 'triage' } });
    const again = await deliver({ sourceKey: 'github-issue:1', metadata: { authorTrusted: true } }, card!.id);
    expect(again?.id).toBe(card!.id);
    expect(placed(again)).toEqual({ board: 'work', stages: ['intake'] });
  });

  it('skips a route whose board was deleted and uses the next one', async () => {
    const { boards, scope, route, deliver } = await setup();
    const stored = await boards.create(scope, docsBoard, 'admin');
    await route({ name: 'Docs', when: DOCS, target: { boardKey: 'docs' } });
    await route({ name: 'Docs fallback', when: DOCS, target: { boardKey: 'work', phaseKey: 'planning' } });
    await boards.delete(scope, 'docs', { expectedRevision: stored.revision });

    expect(placed(await deliver({ sourceKey: 'github-issue:1', metadata: { labels: ['docs'] } }))).toEqual({
      board: 'work',
      stages: ['planning'],
    });
  });

  it('ignores a disabled route and takes the first enabled match in order', async () => {
    const { route, deliver } = await setup();
    await route({ name: 'Off', enabled: false, when: DOCS, target: { boardKey: 'work', phaseKey: 'execute' } });
    await route({ name: 'First', when: DOCS, target: { boardKey: 'work', phaseKey: 'planning' } });
    await route({ name: 'Second', when: DOCS, target: { boardKey: 'work', phaseKey: 'triage' } });

    expect(placed(await deliver({ sourceKey: 'github-issue:1', metadata: { labels: ['docs'] } }))).toEqual({
      board: 'work',
      stages: ['planning'],
    });
  });

  it('places nothing without a routes reader, whatever the project stored', async () => {
    const { route, deliver } = await setup({ withRoutesReader: false });
    await route({ name: 'Everything to triage', target: { boardKey: 'work', phaseKey: 'triage' } });

    expect(placed(await deliver({ sourceKey: 'github-issue:1', metadata: { authorTrusted: true } }))).toEqual({
      board: 'work',
      stages: ['intake'],
    });
  });
});
