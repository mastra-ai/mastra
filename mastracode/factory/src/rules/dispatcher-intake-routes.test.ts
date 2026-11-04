import { describe, expect, it } from 'vitest';

import type { BoardEventFacts } from '../boards/board-events.js';
import { createBoardRegistry, defineBoard } from '../boards/index.js';
import type { BoardRegistry } from '../boards/index.js';
import { ProjectBoardCache } from '../boards/project-boards.js';
import { DEFAULT_INTAKE_ROUTE, PULL_REQUEST_INTAKE_ROUTE } from '../storage/domains/boards/base.js';
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

/**
 * A real dispatcher over real storage, with the project's stored boards and intake routes.
 * Tests start without the default routes every project gets, unless they pass `withDefaultRoute`.
 */
async function setup(
  options: {
    withRoutesReader?: boolean;
    autoRun?: boolean;
    withDefaultRoute?: boolean;
    codeRegistry?: BoardRegistry;
  } = {},
) {
  const seeded = await createFactoryStorageForTests();
  const project = await seeded.projects.create({ orgId: 'org-1', userId: 'user-1', input: { name: 'Routes' } });
  const scope = { orgId: 'org-1', factoryProjectId: project.id };
  const defaults = await seeded.boards.listIntakeRoutes(scope);
  const [defaultRoute] = defaults;
  if (!options.withDefaultRoute) {
    // Last first, so no delete moves (and re-revisions) a route still to delete.
    for (const seededRoute of defaults.toReversed()) {
      await seeded.boards.deleteIntakeRoute(scope, seededRoute.id, { expectedRevision: seededRoute.revision });
    }
  }
  const boards = new ProjectBoardCache({
    codeRegistry: options.codeRegistry ?? createBoardRegistry(),
    storage: seeded.boards,
    recheckMs: 0,
  });
  const configVersion = 'intake-routes-v1';
  const workItems = seeded.workItems;
  const dispatcher = new FactoryDecisionDispatcher({
    controller: {} as never,
    transitionService: new FactoryTransitionService({ storage: workItems, configVersion, boards, audit: seeded.audit }),
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
  /** Gives the dispatcher another turn, a day later, so a decision waiting to retry runs again. */
  const retry = () => dispatcher.runOnce(new Date('2030-01-02T00:00:00Z'));
  /** Commits a status event on an existing card, as an integration does when no rule decided anything, and dispatches it. */
  const deliverEvent = async (cardId: string, event: BoardEventFacts, identity = `event-${(deliveries += 1)}`) => {
    const card = await workItems.get({ orgId: 'org-1', id: cardId });
    const committed = await workItems.commitRuleEvaluation({
      ...scope,
      workItemId: cardId,
      ingress: { identity, triggerType: 'github.issueClosed' },
      configVersion,
      expectedRevision: card!.revision,
      actor: { type: 'system', id: 'rules' },
      outcome: { status: 'accepted' },
      decisions: [{ type: 'routeEvent', idempotencyKey: `${identity}:event-route`, event }],
      causalChain: [],
      now: new Date('2030-01-01T00:00:00Z'),
    });
    await dispatcher.runOnce(new Date('2030-01-01T00:02:00Z'));
    return { committed, card: await workItems.get({ orgId: 'org-1', id: cardId }) };
  };
  /** Puts a card in a phase directly, the way a person's move would leave it. */
  const putAt = async (cardId: string, stage: string) => {
    const card = await workItems.get({ orgId: 'org-1', id: cardId });
    await workItems.commitTransition({
      ...scope,
      workItemId: cardId,
      expectedRevision: card!.revision,
      destinationStage: stage,
      actorId: 'user-1',
      ingress: { identity: `put-${cardId}-${stage}`, triggerType: 'human', transitionId: `put-${cardId}-${stage}` },
      configVersion,
      causalChain: [],
      evaluation: { outcome: 'accepted', decisions: [] },
    });
  };
  /** The route decisions dispatched for a card, with their outcome. */
  const routeDecisions = async (cardId: string) =>
    (await workItems.listDeferredDecisions('org-1', project.id))
      .filter(decision => decision.workItemId === cardId && decision.decision.type === 'routeEvent')
      .map(decision => decision.status);
  const stageAudits = async (cardId: string) =>
    (await seeded.audit.list({ orgId: 'org-1' })).events
      .filter(event => event.targets.some(target => target.id === cardId))
      .map(event => ({ action: event.action, actorId: event.actorId, metadata: event.metadata }));
  return {
    ...seeded,
    scope,
    project,
    defaultRoute: defaultRoute!,
    route,
    deliver,
    deliverEvent,
    putAt,
    routeDecisions,
    stageAudits,
    runs,
    retry,
  };
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

  it("files outside authors' GitHub and GitLab cards in Work › Intake by the default route, and starts nothing", async () => {
    const { boards, scope, defaultRoute, deliver, runs } = await setup({ withDefaultRoute: true, autoRun: true });
    expect(defaultRoute).toMatchObject({
      name: DEFAULT_INTAKE_ROUTE.name,
      target: { boardKey: 'work', phaseKey: 'intake' },
    });
    // A label route would send these to Docs; the default route keeps outside work in Intake first.
    await boards.create(scope, docsBoard, 'admin');
    const arrivals = [
      { sourceKey: 'github-issue:1', board: 'docs', metadata: { authorTrusted: false } },
      { sourceKey: 'github-issue:2', board: 'docs', metadata: {} },
      {
        sourceKey: 'gitlab-issue:3',
        source: 'gitlab-issue' as const,
        board: 'docs',
        metadata: { authorTrusted: false },
      },
    ];
    for (const arrival of arrivals) {
      const card = await deliver({ ...arrival, stage: 'inbox' });
      expect(placed(card), arrival.sourceKey).toEqual({ board: 'work', stages: ['intake'] });
      expect(card?.metadata).toMatchObject({ intakeRouteId: defaultRoute.id });
      // Intake is a resting phase: even with auto-run on, nothing asks to run.
      expect(await runs(card!.id)).toEqual([]);
    }

    // Trusted authors, and integrations without a trust stamp, land where they did before.
    for (const arrival of [
      { sourceKey: 'github-issue:4', metadata: { authorTrusted: true } },
      { sourceKey: 'github-issue:5', metadata: { factoryAuthored: true } },
      { sourceKey: 'linear-issue:ENG-6', source: 'linear-issue' as const, metadata: {} },
    ]) {
      const card = await deliver({ ...arrival, board: 'docs', stage: 'inbox' });
      expect(placed(card), arrival.sourceKey).toEqual({ board: 'docs', stages: ['inbox'] });
      expect(card?.metadata).not.toHaveProperty('intakeRouteId');
    }
  });

  it("files trusted pull requests in Work › PR review by the default route, and outside authors' in Intake", async () => {
    const { boards, scope, deliver, runs } = await setup({ withDefaultRoute: true });
    const pullRequestRoute = (await boards.listIntakeRoutes(scope))[1]!;
    expect(pullRequestRoute).toMatchObject({
      name: PULL_REQUEST_INTAKE_ROUTE.name,
      target: { boardKey: 'work', phaseKey: 'pr-review' },
    });

    for (const arrival of [
      { sourceKey: 'github-pr:1', source: 'github-pr' as const },
      { sourceKey: 'gitlab-mr:2', source: 'gitlab-pr' as const },
    ]) {
      const card = await deliver({ ...arrival, metadata: { authorTrusted: true } });
      expect(placed(card), arrival.sourceKey).toEqual({ board: 'work', stages: ['pr-review'] });
      expect(card?.metadata).toMatchObject({ intakeRouteId: pullRequestRoute.id });
      // Filed in Intake, then moved by a recorded transition, which asks for the review.
      expect(card?.stageHistory.map(entry => entry.stage)).toEqual(['intake', 'pr-review']);
      // Auto-run is off: the review waits for a person to approve it.
      expect(await runs(card!.id)).toEqual(['proposed']);
    }

    const outside = await deliver({
      sourceKey: 'github-pr:3',
      source: 'github-pr',
      metadata: { authorTrusted: false },
    });
    expect(placed(outside)).toEqual({ board: 'work', stages: ['intake'] });
    expect(await runs(outside!.id)).toEqual([]);
  });

  it('places outside work wherever an admin edits the default route to send it, and nowhere once it is disabled', async () => {
    const { boards, scope, defaultRoute, deliver } = await setup({ withDefaultRoute: true });
    await boards.create(scope, docsBoard, 'admin');
    const edited = await boards.updateIntakeRoute(
      scope,
      defaultRoute.id,
      { target: { boardKey: 'work', phaseKey: 'triage' } },
      { expectedRevision: defaultRoute.revision, actor: 'admin' },
    );
    expect(
      placed(
        await deliver({
          sourceKey: 'github-issue:1',
          board: 'docs',
          stage: 'inbox',
          metadata: { authorTrusted: false },
        }),
      ),
    ).toEqual({ board: 'work', stages: ['triage'] });

    await boards.updateIntakeRoute(
      scope,
      defaultRoute.id,
      { enabled: false },
      { expectedRevision: edited.revision, actor: 'admin' },
    );
    expect(
      placed(
        await deliver({
          sourceKey: 'github-issue:2',
          board: 'docs',
          stage: 'inbox',
          metadata: { authorTrusted: false },
        }),
      ),
    ).toEqual({ board: 'docs', stages: ['inbox'] });
  });

  it("leaves a child card where its parent's board rule files it", async () => {
    const { boards, scope, deliver } = await setup({ withDefaultRoute: true });
    await boards.create(scope, docsBoard, 'admin');
    const parent = await deliver({ sourceKey: 'github-issue:1', metadata: { authorTrusted: true } });
    const child = await deliver(
      { sourceKey: 'github-issue:2', board: 'docs', stage: 'inbox', metadata: { authorTrusted: false } },
      parent!.id,
    );
    expect(placed(child)).toEqual({ board: 'docs', stages: ['inbox'] });
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

    // A merge request can't land in Work › Triage, so the GitLab route skips it; a route to
    // Review places it.
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

  it('never moves a Linear card whose issue came back under a new identifier', async () => {
    const { boards, scope, route, deliver, workItems, project } = await setup();
    const linear = (sourceKey: string) =>
      deliver({ sourceKey, source: 'linear-issue', metadata: { linearIssueId: 'issue-1' } });
    const card = await linear('linear-issue:ENG-1');
    expect(placed(card)).toEqual({ board: 'work', stages: ['intake'] });

    await boards.create(scope, docsBoard, 'admin');
    await route({
      name: 'Linear to Docs',
      when: { operator: 'AND', conditions: [{ field: 'source.integration', operator: 'equals', value: 'linear' }] },
      target: { boardKey: 'docs' },
    });
    // The issue moved teams, so Linear now reports it as OPS-1; the card filed as ENG-1 is still its card.
    await linear('linear-issue:OPS-1');

    const cards = await workItems.list(scope);
    expect(cards.map(item => item.id)).toEqual([card!.id]);
    expect(placed(cards[0])).toEqual({ board: 'work', stages: ['intake'] });
    expect(cards[0]!.metadata).not.toHaveProperty('intakeRouteId');
    const decisions = await workItems.listDeferredDecisions('org-1', project.id);
    expect(decisions.map(decision => [decision.status, decision.lastError])).toEqual([
      ['succeeded', null],
      ['succeeded', null],
    ]);
  });

  describe('retrying a card whose move to its route phase failed', () => {
    /** A board that refuses the first move into Ready, as a transient failure would. */
    function flakyRegistry() {
      let refused = false;
      const flaky = defineBoard({
        id: 'flaky',
        title: 'Flaky',
        initialPhase: 'inbox',
        transitionPolicy: context => {
          if (context.toStage !== 'ready' || refused) return undefined;
          refused = true;
          return { type: 'reject', code: 'invalid_transition', reason: 'Not yet.' };
        },
        phases: {
          inbox: { title: 'Inbox', kind: 'resting', outcomes: { ready: 'ready', other: 'other' } },
          ready: { title: 'Ready', kind: 'resting', outcomes: { back: 'inbox' } },
          other: { title: 'Other', kind: 'resting', outcomes: { back: 'inbox' } },
        },
      });
      return createBoardRegistry({ boards: [flaky] });
    }

    async function fileOnce() {
      const harness = await setup({ codeRegistry: flakyRegistry() });
      const routed = await harness.route({
        name: 'All to Ready',
        when: null,
        target: { boardKey: 'flaky', phaseKey: 'ready' },
      });
      const card = await harness.deliver({ sourceKey: 'github-issue:1' });
      expect(placed(card)).toEqual({ board: 'flaky', stages: ['inbox'] });
      const [decision] = await harness.workItems.listDeferredDecisions('org-1', harness.project.id);
      expect(decision).toMatchObject({ status: 'retry', lastError: 'invalid_transition: Not yet.' });
      return { ...harness, routed, card: card! };
    }

    async function settled(harness: Awaited<ReturnType<typeof fileOnce>>) {
      await harness.retry();
      const [decision] = await harness.workItems.listDeferredDecisions('org-1', harness.project.id);
      const card = await harness.workItems.get({ orgId: 'org-1', id: harness.card.id });
      return { status: decision?.status, lastError: decision?.lastError, placed: placed(card ?? undefined) };
    }

    it("keeps retrying the refused move while the route still names that phase, without leaving the card's board", async () => {
      // The transition service replays a refused move by its ingress, so the retry reports the same refusal.
      expect(await settled(await fileOnce())).toEqual({
        status: 'retry',
        lastError: 'invalid_transition: Not yet.',
        placed: { board: 'flaky', stages: ['inbox'] },
      });
    });

    it("leaves the card in its board's first phase once the route is deleted", async () => {
      const harness = await fileOnce();
      await harness.boards.deleteIntakeRoute(harness.scope, harness.routed.id, {
        expectedRevision: harness.routed.revision,
      });
      expect(await settled(harness)).toEqual({
        status: 'succeeded',
        lastError: null,
        placed: { board: 'flaky', stages: ['inbox'] },
      });
    });

    it("keeps the card in its board's first phase when the route now points at another board", async () => {
      const harness = await fileOnce();
      const repointed = await harness.boards.updateIntakeRoute(
        harness.scope,
        harness.routed.id,
        { target: { boardKey: 'work', phaseKey: 'triage' } },
        { expectedRevision: harness.routed.revision, actor: 'admin' },
      );
      expect(await settled(harness)).toEqual({
        status: 'succeeded',
        lastError: null,
        placed: { board: 'flaky', stages: ['inbox'] },
      });
      expect(repointed.target.boardKey).toBe('work');
    });
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

const CLOSED_AS = (reason: 'completed' | 'canceled') =>
  ({ operator: 'AND', conditions: [{ field: 'event.reason', operator: 'equals', value: reason }] }) as const;

describe('intake routes moving existing cards on status events', () => {
  it("moves a closed issue to the phase its route names for the close reason, recorded as the route's move", async () => {
    const { route, deliver, deliverEvent, stageAudits } = await setup();
    const done = await route({
      name: 'Closed as completed',
      on: ['work_item.closed'],
      when: CLOSED_AS('completed'),
      target: { boardKey: 'work', phaseKey: 'done' },
    });
    const canceled = await route({
      name: 'Closed as not planned',
      on: ['work_item.closed'],
      when: CLOSED_AS('canceled'),
      target: { boardKey: 'work', phaseKey: 'canceled' },
    });
    const first = (await deliver({ sourceKey: 'github-issue:1' }))!;
    const second = (await deliver({ sourceKey: 'github-issue:2' }))!;

    const completedMove = await deliverEvent(first.id, { type: 'work_item.closed', reason: 'completed' });
    const canceledMove = await deliverEvent(second.id, { type: 'work_item.closed', reason: 'canceled' });

    expect(completedMove.card).toMatchObject({ stages: ['done'] });
    expect(completedMove.card!.stageHistory.at(-1)).toMatchObject({ stage: 'done', by: `intake-route:${done.id}` });
    expect(canceledMove.card).toMatchObject({ stages: ['canceled'] });
    expect(canceledMove.card!.stageHistory.at(-1)).toMatchObject({
      stage: 'canceled',
      by: `intake-route:${canceled.id}`,
    });
    expect(await stageAudits(second.id)).toContainEqual({
      action: 'factory.work_item.stage_moved',
      actorId: `intake-route:${canceled.id}`,
      metadata: expect.objectContaining({
        cause: 'event_route',
        from: 'intake',
        to: 'canceled',
      }),
    });
  });

  it('leaves the card where it is when no route handles the event or matches it', async () => {
    const { route, deliver, deliverEvent, routeDecisions } = await setup();
    await route({ name: 'Places new cards', target: { boardKey: 'work', phaseKey: 'triage' }, when: DOCS });
    await route({
      name: 'Closed as not planned',
      on: ['work_item.closed'],
      when: CLOSED_AS('canceled'),
      target: { boardKey: 'work', phaseKey: 'canceled' },
    });
    const card = (await deliver({ sourceKey: 'github-issue:1' }))!;

    expect((await deliverEvent(card.id, { type: 'work_item.closed', reason: 'completed' })).card).toMatchObject({
      stages: ['intake'],
    });
    expect((await deliverEvent(card.id, { type: 'work_item.reopened' })).card).toMatchObject({ stages: ['intake'] });
    expect(await routeDecisions(card.id)).toEqual(['succeeded', 'succeeded']);
  });

  it("moves a reopened issue out of Done to Intake, which the board's own next phases don't allow", async () => {
    const { route, deliver, deliverEvent, putAt } = await setup();
    await route({ name: 'Reopened', on: ['work_item.reopened'], target: { boardKey: 'work', phaseKey: 'intake' } });
    const card = (await deliver({ sourceKey: 'github-issue:1' }))!;
    await putAt(card.id, 'done');

    expect((await deliverEvent(card.id, { type: 'work_item.reopened' })).card).toMatchObject({ stages: ['intake'] });
    // The bypass is the route's, not the board's: Work still only lets Done go to PR review.
    expect(createBoardRegistry().get('work')!.allowsTransition('done', 'intake')).toBe(false);
  });

  it('moves a card into a working phase such as Triage only when the route allows it', async () => {
    const { route, deliver, deliverEvent, putAt, routeDecisions, stageAudits, boards, scope } = await setup();
    const reopened = await route({
      name: 'Reopened back to Triage',
      on: ['work_item.reopened'],
      target: { boardKey: 'work', phaseKey: 'triage' },
    });
    const card = (await deliver({ sourceKey: 'github-issue:1' }))!;
    await putAt(card.id, 'done');

    expect((await deliverEvent(card.id, { type: 'work_item.reopened' })).card).toMatchObject({ stages: ['done'] });
    // Refused for good, not retried: the route has to change first.
    expect(await routeDecisions(card.id)).toEqual(['succeeded']);
    expect(await stageAudits(card.id)).toContainEqual({
      action: 'factory.work_item.transition_rejected',
      actorId: expect.stringMatching(/^intake-route:/),
      metadata: expect.objectContaining({ cause: 'event_route', code: 'approval_required', to: 'triage' }),
    });

    await boards.updateIntakeRoute(
      scope,
      reopened.id,
      { allowWorkingPhase: true },
      { expectedRevision: reopened.revision, actor: 'admin' },
    );
    expect((await deliverEvent(card.id, { type: 'work_item.reopened' })).card).toMatchObject({ stages: ['triage'] });
  });

  it("ignores a route that names another board, or is disabled, and takes the next match on the card's board", async () => {
    const { boards, scope, route, deliver, deliverEvent } = await setup();
    await boards.create(scope, docsBoard, 'admin');
    await route({ name: 'Docs', on: ['work_item.closed'], target: { boardKey: 'docs', phaseKey: 'published' } });
    await route({
      name: 'Off',
      enabled: false,
      on: ['work_item.closed'],
      target: { boardKey: 'work', phaseKey: 'canceled' },
    });
    await route({ name: 'Done', on: ['work_item.closed'], target: { boardKey: 'work', phaseKey: 'done' } });
    const card = (await deliver({ sourceKey: 'github-issue:1' }))!;

    expect(placed((await deliverEvent(card.id, { type: 'work_item.closed', reason: 'completed' })).card)).toEqual({
      board: 'work',
      stages: ['done'],
    });
  });

  it('moves a card once for a delivery, however often it is replayed or retried', async () => {
    const { route, deliver, deliverEvent, putAt, retry, workItems } = await setup();
    await route({ name: 'Reopened', on: ['work_item.reopened'], target: { boardKey: 'work', phaseKey: 'intake' } });
    const card = (await deliver({ sourceKey: 'github-issue:1' }))!;
    await putAt(card.id, 'done');

    const first = await deliverEvent(card.id, { type: 'work_item.reopened' }, 'reopen-delivery');
    expect(first.card).toMatchObject({ stages: ['intake'] });
    // A person closes it again; the same delivery replayed (a reconcile pass) must not reopen it.
    await putAt(card.id, 'canceled');
    const replay = await deliverEvent(card.id, { type: 'work_item.reopened' }, 'reopen-delivery');
    expect(replay.committed.status).toBe('replayed');
    await retry();
    const after = await workItems.get({ orgId: 'org-1', id: card.id });
    expect(after).toMatchObject({ stages: ['canceled'] });
    expect(after!.stageHistory.filter(entry => entry.by.startsWith('intake-route:'))).toHaveLength(1);
  });

  it('moves nothing without a routes reader', async () => {
    const { route, deliver, deliverEvent } = await setup({ withRoutesReader: false });
    await route({ name: 'Done', on: ['work_item.closed'], target: { boardKey: 'work', phaseKey: 'done' } });
    const card = (await deliver({ sourceKey: 'github-issue:1' }))!;
    expect((await deliverEvent(card.id, { type: 'work_item.closed', reason: 'completed' })).card).toMatchObject({
      stages: ['intake'],
    });
  });
});
