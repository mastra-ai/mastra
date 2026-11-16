import { randomUUID } from 'node:crypto';

import { describe, expect, it, vi } from 'vitest';

import type { BoardEventFacts } from '../boards/board-events.js';
import { createBoardRegistry, defineBoard } from '../boards/index.js';
import type { BoardRegistry } from '../boards/index.js';
import { arrivalRuleFacts } from '../boards/intake-routing.js';
import { ProjectBoardCache } from '../boards/project-boards.js';
import { autoStartingBoards, createTriageWorkRegistry } from '../boards/test-utils.js';
import {
  CATCH_ALL_INTAKE_ROUTE,
  DEFAULT_INTAKE_ROUTE,
  PULL_REQUEST_INTAKE_ROUTE,
} from '../storage/domains/boards/base.js';
import type { IntakeEvaluator, StoredIntakeRouteInput } from '../storage/domains/boards/base.js';
import { asProjectFromBeforeIntakeEvaluator, createFactoryStorageForTests } from '../storage/test-utils.js';
import { FactoryDecisionDispatcher } from './dispatcher.js';
import type { RuleGroup } from './rule-group.js';
import { FactoryTransitionService } from './transition-service.js';
import type { FactoryCommitDecision } from './types.js';

type LinkedDecision = Extract<FactoryCommitDecision, { type: 'upsertLinkedWorkItem' }>;

const TRUSTED = {
  operator: 'AND',
  conditions: [{ field: 'item.trusted', operator: 'equals', value: true }],
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
 * The project is one from before the evaluator setting, on the route list, unless `project` is
 * `new` (stamped with intake order, as one created today is).
 */
async function setup(
  options: {
    withRoutesReader?: boolean;
    /** Every working phase starts on its own, as on a project that had the retired auto-run switch on. */
    autoStart?: boolean;
    withDefaultRoute?: boolean;
    codeRegistry?: BoardRegistry;
    intakeEvaluator?: IntakeEvaluator;
    project?: 'new' | 'older';
  } = {},
) {
  const seeded = await createFactoryStorageForTests();
  const project = await seeded.projects.create({ orgId: 'org-1', userId: 'user-1', input: { name: 'Routes' } });
  const scope = { orgId: 'org-1', factoryProjectId: project.id };
  if (options.project !== 'new') await asProjectFromBeforeIntakeEvaluator(seeded.storage, scope);
  const defaults = await seeded.boards.listIntakeRoutes(scope);
  const defaultRoute = defaults.find(route => route.name === DEFAULT_INTAKE_ROUTE.name);
  if (!options.withDefaultRoute) {
    // Last first, so no delete moves (and re-revisions) a route still to delete.
    for (const seededRoute of defaults.toReversed()) {
      await seeded.boards.deleteIntakeRoute(scope, seededRoute.id, { expectedRevision: seededRoute.revision });
    }
  }
  const boards = new ProjectBoardCache({
    codeRegistry: options.autoStart
      ? autoStartingBoards(options.codeRegistry ?? createTriageWorkRegistry())
      : (options.codeRegistry ?? createTriageWorkRegistry()),
    storage: seeded.boards,
    recheckMs: 0,
  });
  const configVersion = 'intake-routes-v1';
  const workItems = seeded.workItems;
  /** The contexts cards left, whose sandboxes stop. */
  const contextsLeft: Array<{ workItemId: string; context: string; toContext: string | undefined }> = [];
  const dispatcherWith = (withRoutesReader: boolean) =>
    new FactoryDecisionDispatcher({
      controller: {} as never,
      transitionService: new FactoryTransitionService({
        storage: workItems,
        configVersion,
        boards,
        audit: seeded.audit,
        onContextLeft: ({ workItemId, context, toContext }) => {
          contextsLeft.push({ workItemId, context, toContext });
        },
      }),
      storage: workItems,
      boards,
      ...(withRoutesReader ? { intakeRoutes: seeded.boards } : {}),
      ...(options.intakeEvaluator ? { intakeEvaluator: options.intakeEvaluator } : {}),
      ownerId: 'worker-routes',
    });
  let dispatcher = dispatcherWith(options.withRoutesReader !== false);
  /** A replica that boots with the boards domain working again takes over. */
  const recover = () => {
    dispatcher = dispatcherWith(true);
  };
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
      ingress: { identity: `delivery-${deliveries}` },
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
  const retry = (at = new Date('2030-01-02T00:00:00Z')) => dispatcher.runOnce(at);
  /** Commits a status event on an existing card, as an integration does when no rule decided anything, and dispatches it. */
  const deliverEvent = (cardId: string, event: BoardEventFacts, identity = `event-${(deliveries += 1)}`) =>
    deliverDecision(cardId, { type: 'routeEvent', idempotencyKey: `${identity}:event-route`, event }, identity);
  /** Commits a rule's decision on an existing card, as an integration's default rule would, and dispatches it. */
  const deliverDecision = async (
    cardId: string,
    decision: FactoryCommitDecision,
    identity = `decision-${(deliveries += 1)}`,
  ) => {
    const card = await workItems.get({ orgId: 'org-1', id: cardId });
    const committed = await workItems.commitRuleEvaluation({
      ...scope,
      workItemId: cardId,
      ingress: { identity },
      configVersion,
      expectedRevision: card!.revision,
      actor: { type: 'system', id: 'rules' },
      outcome: { status: 'accepted' },
      decisions: [decision],
      causalChain: [],
      now: new Date('2030-01-01T00:00:00Z'),
    });
    await dispatcher.runOnce(new Date('2030-01-01T00:02:00Z'));
    return { committed, card: await workItems.get({ orgId: 'org-1', id: cardId }) };
  };
  /** Puts a card in a phase directly, the way a person's move would leave it. */
  const putAt = async (cardId: string, stage: string, autonomy?: 'arm') => {
    const card = await workItems.get({ orgId: 'org-1', id: cardId });
    await workItems.commitTransition({
      ...scope,
      ...(autonomy ? { autonomy } : {}),
      workItemId: cardId,
      expectedRevision: card!.revision,
      destinationStage: stage,
      actorId: 'user-1',
      ingress: { identity: `put-${cardId}-${stage}`, transitionId: `put-${cardId}-${stage}` },
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
  /** Commits an update on a card at `at`, as an integration does, without dispatching it. */
  const commitUpdate = async (
    cardId: string,
    event: BoardEventFacts,
    at: string,
    options: { fromCardSession?: true } = {},
  ) => {
    deliveries += 1;
    const card = await workItems.get({ orgId: 'org-1', id: cardId });
    await workItems.commitRuleEvaluation({
      ...scope,
      workItemId: cardId,
      ingress: { identity: `update-${deliveries}` },
      configVersion,
      expectedRevision: card!.revision,
      actor: { type: 'system', id: 'rules' },
      outcome: { status: 'accepted' },
      decisions: [{ type: 'routeEvent', idempotencyKey: `update-${deliveries}:event-route`, event, ...options }],
      causalChain: [],
      now: new Date(at),
    });
  };
  return {
    ...seeded,
    scope,
    project,
    dispatcher,
    commitUpdate,
    defaultRoute: defaultRoute!,
    route,
    deliver,
    deliverEvent,
    deliverDecision,
    putAt,
    recover,
    /** Another replica's dispatcher, working the same queue. */
    otherWorker: () => dispatcherWith(true),
    routeDecisions,
    stageAudits,
    runs,
    retry,
    contextsLeft,
  };
}

function placed(card: { board?: string | null; stages: string[] } | undefined) {
  return card && { board: card.board ?? 'work', stages: card.stages };
}

describe('intake routes placing linked cards', () => {
  describe('a pull request that closes an issue on the board', () => {
    const pullRequest = (issueId: string, authorTrusted: boolean) => ({
      sourceKey: 'github-pr:17',
      source: 'github-pr' as const,
      title: 'PR 17',
      closesIssue: { workItemId: issueId },
      metadata: { authorTrusted, state: 'open' },
    });
    const sourceTypes = async (seeded: Awaited<ReturnType<typeof setup>>, id: string) =>
      (await seeded.workItems.get({ orgId: 'org-1', id }))!.workItem.sources.map(source => source.sourceType);

    it("links an outsider's pull request to the issue's card, and neither moves the card nor runs anything", async () => {
      const seeded = await setup({ withDefaultRoute: true, autoStart: true });
      const issue = (await seeded.deliver({ sourceKey: 'github-issue:42', metadata: { authorTrusted: false } }))!;

      expect(await seeded.deliver(pullRequest(issue.id, false))).toBeUndefined();

      const card = (await seeded.workItems.get({ orgId: 'org-1', id: issue.id }))!;
      expect(await sourceTypes(seeded, issue.id)).toEqual(['issue', 'pull-request']);
      expect(placed(card)).toEqual({ board: 'work', stages: ['intake'] });
      expect(card.metadata).toMatchObject({ untrustedPullRequests: [expect.stringContaining('17')] });
      expect(await seeded.workItems.list(seeded.scope)).toHaveLength(1);
      expect(await seeded.runs(issue.id)).toEqual([]);
    });

    it("takes a waiting issue's card to Review for a trusted pull request, once, by the seeded card-move rule", async () => {
      const seeded = await setup({ withDefaultRoute: true });
      const linkedRoute = (await seeded.boards.listIntakeRoutes(seeded.scope)).find(
        route => route.name === 'Trusted pull requests take a waiting issue to Review',
      )!;
      const issue = (await seeded.deliver({ sourceKey: 'github-issue:42', metadata: { authorTrusted: true } }))!;

      expect(await seeded.deliver(pullRequest(issue.id, true))).toBeUndefined();
      // The same pull request filed again (a redelivery, or a later event) moves nothing more.
      await seeded.deliver(pullRequest(issue.id, true));
      await seeded.retry();

      const card = (await seeded.workItems.get({ orgId: 'org-1', id: issue.id }))!;
      expect(await sourceTypes(seeded, issue.id)).toEqual(['issue', 'pull-request']);
      expect(placed(card)).toEqual({ board: 'work', stages: ['pr-review'] });
      expect(card.metadata).not.toHaveProperty('untrustedPullRequests');
      expect(card.stageHistory.filter(entry => entry.by === `intake-route:${linkedRoute.id}`)).toHaveLength(1);
      expect(await seeded.workItems.list(seeded.scope)).toHaveLength(1);
    });

    it('hands the card the link as it happened, even when a person moved the card before its event was queued', async () => {
      const seeded = await setup({ withDefaultRoute: true });
      const issue = (await seeded.deliver({ sourceKey: 'github-issue:42', metadata: { authorTrusted: true } }))!;
      // A person moves the card just after the pull request attached, before its event is queued.
      const commit = seeded.workItems.commitRuleEvaluation.bind(seeded.workItems);
      let raced = false;
      vi.spyOn(seeded.workItems, 'commitRuleEvaluation').mockImplementation(async input => {
        if (input.ingress.identity.startsWith('decision:linked-pull-request:') && !raced) {
          raced = true;
          await seeded.putAt(issue.id, 'planning');
        }
        return commit(input);
      });

      await seeded.deliver(pullRequest(issue.id, true));
      await seeded.retry();

      // The pull request linked while the card waited in Intake with no other pull request.
      const [linked] = (await seeded.workItems.listDeferredDecisions('org-1', seeded.scope.factoryProjectId)).filter(
        entry => entry.decision.type === 'routeEvent' && entry.workItemId === issue.id,
      );
      expect(linked?.decision).toMatchObject({
        event: {
          type: 'pull_request.opened',
          pullRequestTrusted: true,
          closedIssue: { phase: 'intake', hasPullRequest: false },
        },
      });
      // The person's move came after the link, so it stands.
      expect(placed((await seeded.workItems.get({ orgId: 'org-1', id: issue.id }))!)).toEqual({
        board: 'work',
        stages: ['planning'],
      });
    });

    it("links a person's pull request to the card on whichever board it sits", async () => {
      const seeded = await setup();
      await seeded.boards.create(seeded.scope, docsBoard, 'admin');
      await seeded.route({ name: 'Docs', when: DOCS, target: { boardKey: 'docs', phaseKey: 'inbox' } });
      const issue = (await seeded.deliver({
        sourceKey: 'github-issue:42',
        metadata: { authorTrusted: true, labels: ['docs'] },
      }))!;
      expect(placed(issue)).toEqual({ board: 'docs', stages: ['inbox'] });

      expect(await seeded.deliver(pullRequest(issue.id, true))).toBeUndefined();

      expect(await sourceTypes(seeded, issue.id)).toEqual(['issue', 'pull-request']);
      expect(placed((await seeded.workItems.get({ orgId: 'org-1', id: issue.id }))!)).toEqual({
        board: 'docs',
        stages: ['inbox'],
      });
    });

    it('files the pull request on its own card when the issue card is finished', async () => {
      const seeded = await setup();
      const issue = (await seeded.deliver({ sourceKey: 'github-issue:42', metadata: { authorTrusted: true } }))!;
      await seeded.putAt(issue.id, 'done');

      const own = await seeded.deliver(pullRequest(issue.id, false));

      expect(own!.id).not.toBe(issue.id);
      expect(await sourceTypes(seeded, issue.id)).toEqual(['issue']);
    });
  });

  it("files every arrival in the default board's first phase when the project has no routes", async () => {
    const { deliver } = await setup();
    expect(
      placed(
        await deliver({
          sourceKey: 'github-issue:1',
          board: 'docs',
          stage: 'inbox',
          metadata: { authorTrusted: true },
        }),
      ),
    ).toEqual({
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
    // The card remembers the route, so label changes and replays leave it where the route put it.
    expect(trusted?.metadata).toMatchObject({ intakeRouteId: toTriage.id });
    // Entered through the board's initial phase, then moved by a recorded transition.
    expect(trusted?.stageHistory.map(entry => entry.stage)).toEqual(['intake', 'triage']);

    const untrusted = await deliver({ sourceKey: 'github-issue:2', metadata: { authorTrusted: false } });
    expect(placed(untrusted)).toEqual({ board: 'work', stages: ['intake'] });
    expect(untrusted?.metadata).not.toHaveProperty('intakeRouteId');
  });

  it("files outside authors' GitHub and GitLab cards in Work › Intake by the default route, and starts nothing", async () => {
    const { boards, scope, defaultRoute, deliver, runs } = await setup({ withDefaultRoute: true, autoStart: true });
    expect(defaultRoute).toMatchObject({
      name: DEFAULT_INTAKE_ROUTE.name,
      target: { boardKey: 'work', phaseKey: 'intake' },
    });
    // Even with a Docs board installed, the default route keeps outside work in Intake first.
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
      // Intake is a resting phase: even with every working phase starting on its own, nothing asks to run.
      expect(await runs(card!.id)).toEqual([]);
    }

    // Trusted authors, and integrations without a trust stamp, fall to the catch-all: the default
    // board's first phase, whatever board the integration's rule named.
    const catchAll = (await boards.listIntakeRoutes(scope)).find(route => route.name === CATCH_ALL_INTAKE_ROUTE.name)!;
    for (const arrival of [
      { sourceKey: 'github-issue:4', metadata: { authorTrusted: true } },
      { sourceKey: 'github-issue:5', metadata: { factoryAuthored: true } },
      { sourceKey: 'linear-issue:ENG-6', source: 'linear-issue' as const, metadata: {} },
    ]) {
      const card = await deliver({ ...arrival });
      expect(placed(card), arrival.sourceKey).toEqual({ board: 'work', stages: ['intake'] });
      expect(card?.metadata).toMatchObject({ intakeRouteId: catchAll.id });
    }
  });

  it('sends the issues and pull requests no other route takes to the board an admin points the catch-alls at', async () => {
    const { boards, scope, deliver } = await setup({ withDefaultRoute: true });
    await boards.create(scope, docsBoard, 'admin');
    const routes = await boards.listIntakeRoutes(scope);
    const catchAll = routes.find(route => route.name === CATCH_ALL_INTAKE_ROUTE.name)!;
    const pullRequests = routes.find(route => route.name === PULL_REQUEST_INTAKE_ROUTE.name)!;
    await boards.updateIntakeRoute(
      scope,
      catchAll.id,
      { target: { boardKey: 'docs' } },
      { expectedRevision: catchAll.revision, actor: 'admin' },
    );
    // Pull requests arrive on their own event, so their catch-all is the pull request route.
    await boards.updateIntakeRoute(
      scope,
      pullRequests.id,
      { target: { boardKey: 'docs' } },
      { expectedRevision: pullRequests.revision, actor: 'admin' },
    );

    for (const arrival of [
      { sourceKey: 'github-issue:1', metadata: { authorTrusted: true } },
      { sourceKey: 'github-pr:2', source: 'github-pr' as const, metadata: { authorTrusted: true, state: 'open' } },
      { sourceKey: 'linear-issue:ENG-3', source: 'linear-issue' as const, metadata: {} },
    ]) {
      // The integration's rule files on Work; the catch-all decides.
      const card = await deliver({ ...arrival, board: 'work', stage: 'intake' });
      expect(placed(card), arrival.sourceKey).toEqual({ board: 'docs', stages: ['inbox'] });
      expect(card?.metadata).toMatchObject({
        intakeRouteId: arrival.source === 'github-pr' ? pullRequests.id : catchAll.id,
      });
    }
    // Outside authors still meet their own route first.
    const outside = await deliver({ sourceKey: 'github-issue:4', metadata: { authorTrusted: false } });
    expect(placed(outside)).toEqual({ board: 'work', stages: ['intake'] });
  });

  it("files trusted pull requests in Work › PR review by the default route, and outside authors' in Intake", async () => {
    const { boards, scope, deliver, runs } = await setup({ withDefaultRoute: true });
    const pullRequestRoute = (await boards.listIntakeRoutes(scope)).find(
      route => route.name === PULL_REQUEST_INTAKE_ROUTE.name,
    )!;
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

  it.each(['older', 'new'] as const)(
    "still sends an outside author's pull request to Intake past a pull_request.opened route stored by 0.28 (%s project)",
    async project => {
      const { storage, boards, scope, deliver } = await setup({ project });
      // As 0.28 wrote them: a "PR opened → Review" card move ahead of the outside-authors hold, which named no events.
      const row = (id: string, position: number, fields: Record<string, unknown>) =>
        storage.ops.insertOne('factory_intake_routes', {
          id,
          org_id: scope.orgId,
          factory_project_id: scope.factoryProjectId,
          enabled: true,
          position,
          join_closed_issue: false,
          revision: 1,
          created_by: 'admin',
          created_at: new Date(),
          updated_by: 'admin',
          updated_at: new Date(),
          ...fields,
        });
      const moveId = randomUUID();
      const outsideId = randomUUID();
      await row(moveId, 0, {
        name: 'Opened pull requests go to Review',
        when_condition: null,
        board_key: 'work',
        phase_key: 'pr-review',
        on_events: ['pull_request.opened'],
      });
      await row(outsideId, 1, {
        name: DEFAULT_INTAKE_ROUTE.name,
        when_condition: DEFAULT_INTAKE_ROUTE.when,
        board_key: 'work',
        phase_key: 'intake',
        on_events: null,
      });

      const outside = await deliver({
        sourceKey: 'github-pr:3',
        source: 'github-pr',
        metadata: { authorTrusted: false },
      });

      expect(placed(outside)).toEqual({ board: 'work', stages: ['intake'] });
      expect(outside?.metadata).toMatchObject({ intakeRouteId: outsideId });
      // Read as written, so editing it never changes what it does.
      expect(await boards.getIntakeRoute(scope, moveId)).toMatchObject({
        on: ['pull_request.opened'],
        pullRequestOpenedMovesOnly: true,
      });
    },
  );

  it('places outside work wherever an admin edits the default route to send it, and on Work once it is disabled', async () => {
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
    ).toEqual({ board: 'work', stages: ['intake'] });
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
    // Work › PR review places it.
    await route({
      name: 'GitLab reviews',
      when: { operator: 'AND', conditions: [{ field: 'source.integration', operator: 'equals', value: 'gitlab' }] },
      target: { boardKey: 'work', phaseKey: 'pr-review' },
    });
    const mergeRequest = await deliver({
      sourceKey: 'gitlab-mr:5',
      source: 'gitlab-pr',
      metadata: { authorTrusted: true },
    });
    expect(placed(mergeRequest)).toEqual({ board: 'work', stages: ['pr-review'] });
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

  it("routes a decision that names a later phase, as a host's rule overriding the default would", async () => {
    const { boards, scope, route, deliver } = await setup();
    await boards.create(scope, docsBoard, 'admin');
    await route({ name: 'Everything to Docs', target: { boardKey: 'docs', phaseKey: 'writing' } });

    // The rule's board and phase don't place the card: the project's routes do.
    const requested = await deliver({
      sourceKey: 'github-pr:7',
      source: 'github-pr',
      stage: 'pr-review',
      metadata: { authorTrusted: true },
    });
    expect(placed(requested)).toEqual({ board: 'docs', stages: ['writing'] });

    // With no route matching, it lands on the default board's first phase, not the phase the rule named.
    const { route: onlyLinear, deliver: deliverUnmatched } = await setup();
    await onlyLinear({
      name: 'Linear to planning',
      when: { operator: 'AND', conditions: [{ field: 'source.integration', operator: 'equals', value: 'linear' }] },
      target: { boardKey: 'work', phaseKey: 'planning' },
    });
    const unmatched = await deliverUnmatched({
      sourceKey: 'github-pr:8',
      source: 'github-pr',
      stage: 'pr-review',
      metadata: { authorTrusted: true },
    });
    expect(placed(unmatched)).toEqual({ board: 'work', stages: ['intake'] });
  });

  it('does not re-route a decision that places the card outright (skipRules)', async () => {
    const { route, deliver } = await setup();
    await route({ name: 'Everything to triage', target: { boardKey: 'work', phaseKey: 'triage' } });

    expect(placed(await deliver({ sourceKey: 'github-issue:1', stage: 'planning', skipRules: true }))).toEqual({
      board: 'work',
      stages: ['planning'],
    });
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

  it('places nothing without a routes reader under a forced route list, whatever the project stored', async () => {
    const { route, deliver } = await setup({ withRoutesReader: false, intakeEvaluator: 'route-list' });
    await route({ name: 'Everything to triage', target: { boardKey: 'work', phaseKey: 'triage' } });

    expect(placed(await deliver({ sourceKey: 'github-issue:1', metadata: { authorTrusted: true } }))).toEqual({
      board: 'work',
      stages: ['intake'],
    });
  });
});

const CLOSED_AS = (reason: 'completed' | 'canceled') =>
  ({ operator: 'AND', conditions: [{ field: 'event.reason', operator: 'equals', value: reason }] }) as const;

/** A route condition testing one fact. */
const when = (field: string, operator: 'equals' | 'contains' | 'in' | 'exists', value?: string | string[]) =>
  ({ operator: 'AND', conditions: [{ field, operator, value }] }) as const;

describe('intake routes sending a repository, team or project to its own board', () => {
  // Each arrival carries what that integration's default rule files a new item with.
  const githubIssue = (repository: string, number: number) => ({
    sourceKey: `github:${repository}:issue:${number}`,
    source: 'github-issue' as const,
    url: `https://github.com/${repository}/issues/${number}`,
    metadata: { githubRepositoryId: 7, githubIssueNumber: number, state: 'open', assignees: ['octocat'], labels: [] },
  });
  const githubPullRequest = (repository: string, number: number) => ({
    sourceKey: `github:${repository}:pull-request:${number}`,
    source: 'github-pr' as const,
    url: `https://github.com/${repository}/pull/${number}`,
    metadata: { githubRepositoryId: 7, githubPullRequestNumber: number, authorTrusted: true, labels: [] },
  });
  const gitlabIssue = (project: string, number: number) => ({
    sourceKey: `gitlab:${project}:issue:${number}`,
    source: 'gitlab-issue' as const,
    url: `https://gitlab.com/${project}/-/issues/${number}`,
    metadata: { gitlabProjectId: 9, gitlabIssueIid: number, identifier: `${project}#${number}`, labels: [] },
  });
  const linearIssue = (team: string, number: number, state = 'Todo') => ({
    sourceKey: `linear:${team}-${number}`,
    source: 'linear-issue' as const,
    url: `https://linear.app/acme/issue/${team}-${number}`,
    metadata: {
      linearIssueId: `issue-${team}-${number}`,
      identifier: `${team}-${number}`,
      linearState: state,
      linearTeam: team,
      linearAssignee: 'Ada',
      assignee: 'Ada',
      labels: [],
    },
  });
  const jiraIssue = (project: string, number: number) => ({
    sourceKey: `jira-${project}-${number}`,
    source: 'jira-issue' as const,
    url: `https://acme.atlassian.net/browse/${project}-${number}`,
    metadata: {
      identifier: `${project}-${number}`,
      state: 'To Do',
      project,
      site: 'acme',
      assignees: ['Grace'],
      labels: [],
    },
  });

  it("sends one GitHub repository's issues and pull requests to a stored board, whatever the case", async () => {
    const { boards, scope, route, deliver } = await setup();
    await boards.create(scope, docsBoard, 'admin');
    await route({
      name: 'App to Docs',
      when: when('source.repository', 'equals', 'Acme/App'),
      target: { boardKey: 'docs' },
    });

    expect(placed(await deliver(githubIssue('acme/app', 12)))).toEqual({ board: 'docs', stages: ['inbox'] });
    expect(placed(await deliver(githubPullRequest('acme/app', 13)))).toEqual({ board: 'docs', stages: ['inbox'] });
    expect(placed(await deliver(githubIssue('acme/site', 14)))).toEqual({ board: 'work', stages: ['intake'] });
  });

  it("sends one GitLab project's issues to a stored board, by its full group path", async () => {
    const { boards, scope, route, deliver } = await setup();
    await boards.create(scope, docsBoard, 'admin');
    await route({
      name: 'Platform to Docs',
      when: when('source.repository', 'equals', 'acme/platform/api'),
      target: { boardKey: 'docs' },
    });

    expect(placed(await deliver(gitlabIssue('acme/platform/api', 3)))).toEqual({ board: 'docs', stages: ['inbox'] });
    expect(placed(await deliver(gitlabIssue('acme/platform/web', 4)))).toEqual({ board: 'work', stages: ['intake'] });
  });

  it("sends one Linear team's issues to a stored board, by the team key", async () => {
    const { boards, scope, route, deliver } = await setup();
    await boards.create(scope, docsBoard, 'admin');
    await route({
      name: 'ENG to Docs',
      when: when('source.repository', 'equals', 'eng'),
      target: { boardKey: 'docs' },
    });

    expect(placed(await deliver(linearIssue('ENG', 12)))).toEqual({ board: 'docs', stages: ['inbox'] });
    expect(placed(await deliver(linearIssue('OPS', 12)))).toEqual({ board: 'work', stages: ['intake'] });
  });

  it("sends one Jira project's issues to a stored board, by the project key", async () => {
    const { boards, scope, route, deliver } = await setup();
    await boards.create(scope, docsBoard, 'admin');
    await route({
      name: 'OPS to Docs',
      when: when('source.repository', 'in', ['OPS', 'SRE']),
      target: { boardKey: 'docs' },
    });

    expect(placed(await deliver(jiraIssue('OPS', 3)))).toEqual({ board: 'docs', stages: ['inbox'] });
    expect(placed(await deliver(jiraIssue('ENG', 3)))).toEqual({ board: 'work', stages: ['intake'] });
  });

  it('places by the item key, state, provider and assignees every provider reports', async () => {
    const { boards, scope, route, deliver } = await setup();
    await boards.create(scope, docsBoard, 'admin');
    await route({ name: 'Key', when: when('item.key', 'equals', 'acme/app#21'), target: { boardKey: 'docs' } });
    await route({
      name: 'State',
      when: when('item.state', 'equals', 'in review'),
      target: { boardKey: 'work', phaseKey: 'planning' },
    });
    await route({
      name: 'Assignee',
      when: when('item.assignees', 'contains', 'grace'),
      target: { boardKey: 'work', phaseKey: 'triage' },
    });
    await route({ name: 'Provider', when: when('source.provider', 'equals', 'linear'), target: { boardKey: 'docs' } });

    expect(placed(await deliver(githubIssue('acme/app', 21)))).toEqual({ board: 'docs', stages: ['inbox'] });
    expect(placed(await deliver(githubIssue('acme/app', 22)))).toEqual({ board: 'work', stages: ['intake'] });
    expect(placed(await deliver(linearIssue('ENG', 5, 'In Review')))).toEqual({ board: 'work', stages: ['planning'] });
    expect(placed(await deliver(jiraIssue('OPS', 6)))).toEqual({ board: 'work', stages: ['triage'] });
    expect(placed(await deliver(linearIssue('ENG', 7)))).toEqual({ board: 'docs', stages: ['inbox'] });
  });

  it('sends assigned items by who they are assigned to, and leaves unassigned ones to the next route', async () => {
    const { boards, scope, route, deliver } = await setup();
    await boards.create(scope, docsBoard, 'admin');
    await route({ name: "Grace's", when: when('item.assignees', 'equals', 'grace'), target: { boardKey: 'docs' } });
    await route({
      name: 'Assigned',
      when: when('item.assignees', 'exists'),
      target: { boardKey: 'work', phaseKey: 'triage' },
    });
    const unassigned = { ...jiraIssue('OPS', 9), metadata: { ...jiraIssue('OPS', 9).metadata, assignees: [] } };

    expect(placed(await deliver(jiraIssue('OPS', 8)))).toEqual({ board: 'docs', stages: ['inbox'] });
    expect(placed(await deliver(linearIssue('ENG', 10)))).toEqual({ board: 'work', stages: ['triage'] });
    expect(placed(await deliver(unassigned))).toEqual({ board: 'work', stages: ['intake'] });
  });
});

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
    expect(createTriageWorkRegistry().get('work')!.allowsTransition('done', 'intake')).toBe(false);
  });

  it("moves a card into a working phase such as Triage, where the phase's own start decides the run", async () => {
    const { route, deliver, deliverEvent, putAt, runs, stageAudits, workItems } = await setup();
    const reopened = await route({
      name: 'Reopened back to Triage',
      on: ['work_item.reopened'],
      target: { boardKey: 'work', phaseKey: 'triage' },
    });
    const card = (await deliver({ sourceKey: 'github-issue:1' }))!;
    // Armed by a person before the issue closed.
    await putAt(card.id, 'done', 'arm');
    expect((await workItems.get({ orgId: 'org-1', id: card.id }))?.autonomyArmedAt).toBeInstanceOf(Date);

    const moved = (await deliverEvent(card.id, { type: 'work_item.reopened' })).card;
    expect(moved).toMatchObject({ stages: ['triage'] });
    expect(moved!.stageHistory.at(-1)).toMatchObject({ stage: 'triage', by: `intake-route:${reopened.id}` });
    expect(await stageAudits(card.id)).not.toContainEqual(
      expect.objectContaining({ action: 'factory.work_item.transition_rejected' }),
    );
    // The reopen is not a person's say-so, and Triage does not start on its own: its run waits for a person.
    expect(moved?.autonomyArmedAt).toBeNull();
    expect(await runs(card.id)).toEqual(['proposed']);
  });

  it("starts a route-moved card's run only where the phase's autoStartWhen matches the card", async () => {
    const { boards, scope, route, deliver, deliverEvent, putAt, runs } = await setup();
    await boards.create(
      scope,
      {
        ...docsBoard,
        phases: docsBoard.phases.map(phase =>
          phase.key === 'writing'
            ? {
                ...phase,
                runner: { context: 'work', skill: 'write-docs' },
                autoStart: true,
                autoStartWhen: {
                  operator: 'AND',
                  conditions: [{ field: 'item.title', operator: 'contains', value: 'urgent' }],
                },
              }
            : phase,
        ),
      },
      'admin',
    );
    await route({
      name: 'Reopened back to Writing',
      on: ['work_item.reopened'],
      target: { boardKey: 'docs', phaseKey: 'writing' },
    });
    // New cards land where a route puts them, so one files these on the docs board.
    await route({ name: 'Docs', when: null, target: { boardKey: 'docs', phaseKey: 'inbox' } });
    const urgent = (await deliver({
      sourceKey: 'github-issue:1',
      title: 'urgent fix',
    }))!;
    const routine = (await deliver({ sourceKey: 'github-issue:2', title: 'typo' }))!;
    await putAt(urgent.id, 'published');
    await putAt(routine.id, 'published');

    await deliverEvent(urgent.id, { type: 'work_item.reopened' });
    await deliverEvent(routine.id, { type: 'work_item.reopened' });
    // No project setting can start the second: the board's condition alone decides.
    const started = await runs(urgent.id);
    expect(started).toHaveLength(1);
    expect(started).not.toContain('proposed');
    expect(await runs(routine.id)).toEqual(['proposed']);
  });

  it('re-reviews a pull request Factory opened when a route moves it back into review, and asks a person for any other', async () => {
    const { route, deliver, deliverEvent, putAt, runs } = await setup();
    await route({
      name: 'Reopened back to review',
      on: ['work_item.reopened'],
      target: { boardKey: 'work', phaseKey: 'pr-review' },
    });
    const pullRequest = (n: number, factoryAuthored: boolean) =>
      deliver({
        sourceKey: `github-pr:${n}`,
        source: 'github-pr',
        title: `PR ${n}`,
        metadata: { authorTrusted: true, state: 'open', factoryAuthored },
      });
    const own = (await pullRequest(1, true))!;
    const theirs = (await pullRequest(2, false))!;
    await putAt(own.id, 'done');
    await putAt(theirs.id, 'done');

    expect((await deliverEvent(own.id, { type: 'work_item.reopened' })).card).toMatchObject({ stages: ['pr-review'] });
    expect((await deliverEvent(theirs.id, { type: 'work_item.reopened' })).card).toMatchObject({
      stages: ['pr-review'],
    });
    // Work's review phase doesn't start on its own: only Factory's own code goes back for review unasked.
    const started = await runs(own.id);
    expect(started).toHaveLength(1);
    expect(started).not.toContain('proposed');
    expect(await runs(theirs.id)).toEqual(['proposed']);
  });

  it('starts the run of a working phase a route moves a card into when that phase starts on its own', async () => {
    const { boards, scope, route, deliver, deliverEvent, putAt, runs } = await setup();
    await boards.create(
      scope,
      {
        ...docsBoard,
        phases: docsBoard.phases.map(phase =>
          phase.key === 'writing'
            ? { ...phase, runner: { context: 'work', skill: 'write-docs' }, autoStart: true }
            : phase,
        ),
      },
      'admin',
    );
    await route({
      name: 'Reopened back to Writing',
      on: ['work_item.reopened'],
      target: { boardKey: 'docs', phaseKey: 'writing' },
    });
    // Routes, not the filing decision, put the card on Docs.
    await route({ name: 'New cards go to Docs', target: { boardKey: 'docs', phaseKey: 'inbox' } });
    const card = (await deliver({ sourceKey: 'github-issue:1' }))!;
    expect(card).toMatchObject({ board: 'docs', stages: ['inbox'] });
    await putAt(card.id, 'published');
    expect((await deliverEvent(card.id, { type: 'work_item.reopened' })).card).toMatchObject({ stages: ['writing'] });
    const started = await runs(card.id);
    expect(started).toHaveLength(1);
    expect(started).not.toContain('proposed');
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

  describe('a card-move rule sending the card to another board', () => {
    const shipBoard = {
      key: 'ship',
      name: 'Ship',
      phases: [
        { key: 'queued', name: 'Queued', kind: 'resting' as const, nextPhases: ['ready'] },
        {
          key: 'ready',
          name: 'Ready',
          kind: 'working' as const,
          runner: { context: 'release', skill: 'factory-ship' },
          autoStart: true,
          nextPhases: ['shipped'],
        },
        { key: 'shipped', name: 'Shipped', kind: 'terminal' as const },
      ],
    };

    it('moves the same card from Work › Building to Ship › Ready, stopping Work and starting Ship', async () => {
      const { boards, scope, route, deliver, deliverEvent, putAt, runs, contextsLeft, workItems } = await setup();
      await boards.create(scope, shipBoard, 'admin');
      const ship = await route({
        name: 'Opened pull requests ship',
        on: ['pull_request.synchronized'],
        target: { boardKey: 'work', moveToBoardKey: 'ship', phaseKey: 'ready' },
      });
      const card = (await deliver({ sourceKey: 'github-issue:1' }))!;
      await putAt(card.id, 'execute');

      const moved = (await deliverEvent(card.id, { type: 'pull_request.synchronized', pullRequestTrusted: true }))
        .card!;

      expect(moved.id).toBe(card.id);
      expect(placed(moved)).toEqual({ board: 'ship', stages: ['ready'] });
      expect(moved.stageHistory.at(-1)).toMatchObject({ stage: 'ready', by: `intake-route:${ship.id}` });
      expect(await workItems.list(scope)).toHaveLength(1);
      expect(contextsLeft).toContainEqual({ workItemId: card.id, context: 'work', toContext: 'release' });
      const started = await runs(card.id);
      expect(started).toHaveLength(1);
      expect(started).not.toContain('proposed');
    });

    it("keeps the run the new board asks for, even when another worker parks it before the old board's work is dropped", async () => {
      const { boards, scope, route, deliver, deliverEvent, putAt, runs, workItems, otherWorker } = await setup();
      // Ship's run waits for a person's approval: a worker parks it as a proposal.
      await boards.create(
        scope,
        {
          ...shipBoard,
          phases: shipBoard.phases.map(phase => (phase.key === 'ready' ? { ...phase, autoStart: false } : phase)),
        },
        'admin',
      );
      await route({
        name: 'Pushed pull requests ship',
        on: ['pull_request.synchronized'],
        target: { boardKey: 'work', moveToBoardKey: 'ship', phaseKey: 'ready' },
      });
      const card = (await deliver({ sourceKey: 'github-issue:1' }))!;
      await putAt(card.id, 'execute');
      const supersede = workItems.supersedeDecisionsForWorkItem.bind(workItems);
      vi.spyOn(workItems, 'supersedeDecisionsForWorkItem').mockImplementationOnce(async input => {
        await otherWorker().runOnce(new Date('2030-01-01T00:02:30Z'));
        return supersede(input);
      });

      const moved = (await deliverEvent(card.id, { type: 'pull_request.synchronized', pullRequestTrusted: true }))
        .card!;

      expect(placed(moved)).toEqual({ board: 'ship', stages: ['ready'] });
      expect(await runs(card.id)).toContain('proposed');
    });

    it("records a new phase entry when the card moves to another board's phase of the same name", async () => {
      const { boards, scope, route, deliver, deliverEvent, putAt } = await setup();
      await boards.create(
        scope,
        {
          key: 'release',
          name: 'Release',
          phases: [
            { key: 'queued', name: 'Queued', kind: 'resting' as const, nextPhases: ['pr-review'] },
            { key: 'pr-review', name: 'Review', kind: 'resting' as const, nextPhases: [] },
          ],
        },
        'admin',
      );
      const release = await route({
        name: 'Pushed reviews go to Release',
        on: ['pull_request.synchronized'],
        target: { boardKey: 'work', moveToBoardKey: 'release', phaseKey: 'pr-review' },
      });
      const card = (await deliver({ sourceKey: 'github-issue:1' }))!;
      await putAt(card.id, 'pr-review');

      const moved = (await deliverEvent(card.id, { type: 'pull_request.synchronized', pullRequestTrusted: true }))
        .card!;

      expect(placed(moved)).toEqual({ board: 'release', stages: ['pr-review'] });
      const reviews = moved.stageHistory.filter(entry => entry.stage === 'pr-review');
      expect(reviews).toEqual([
        expect.objectContaining({ by: 'user-1', exitedBy: `intake-route:${release.id}` }),
        expect.objectContaining({ by: `intake-route:${release.id}` }),
      ]);
      expect(reviews[1]).not.toHaveProperty('exitedAt');
    });

    it('moves a card once per event when two boards send cards to each other', async () => {
      const { boards, scope, route, deliver, deliverEvent, putAt, retry, workItems } = await setup();
      await boards.create(scope, shipBoard, 'admin');
      await route({
        name: 'Work to Ship',
        on: ['pull_request.synchronized'],
        target: { boardKey: 'work', moveToBoardKey: 'ship', phaseKey: 'ready' },
      });
      await route({
        name: 'Ship to Work',
        on: ['pull_request.synchronized'],
        target: { boardKey: 'ship', moveToBoardKey: 'work', phaseKey: 'execute' },
      });
      const card = (await deliver({ sourceKey: 'github-issue:1' }))!;
      await putAt(card.id, 'execute');

      expect(
        placed(
          (await deliverEvent(card.id, { type: 'pull_request.synchronized', pullRequestTrusted: true }, 'push-1')).card,
        ),
      ).toEqual({
        board: 'ship',
        stages: ['ready'],
      });
      await deliverEvent(card.id, { type: 'pull_request.synchronized', pullRequestTrusted: true }, 'push-1');
      await retry();
      const replayed = await workItems.get({ orgId: 'org-1', id: card.id });
      expect(placed(replayed!)).toEqual({ board: 'ship', stages: ['ready'] });

      expect(
        placed(
          (await deliverEvent(card.id, { type: 'pull_request.synchronized', pullRequestTrusted: true }, 'push-2')).card,
        ),
      ).toEqual({
        board: 'work',
        stages: ['execute'],
      });
      const after = await workItems.get({ orgId: 'org-1', id: card.id });
      expect(after!.stageHistory.filter(entry => entry.by.startsWith('intake-route:'))).toHaveLength(2);
    });

    it("skips a matching rule whose target can't hold the card, with a warning in the decision log, and takes the next one", async () => {
      const { boards, scope, route, deliver, deliverEvent, putAt } = await setup();
      const recorded = vi.spyOn(boards, 'recordIntakeDecision');
      await boards.create(scope, shipBoard, 'admin');
      const broken = await route({
        name: 'Gone phase',
        on: ['pull_request.synchronized'],
        target: { boardKey: 'work', moveToBoardKey: 'ship', phaseKey: 'staging' },
      });
      await route({
        name: 'Plan again',
        on: ['pull_request.synchronized'],
        target: { boardKey: 'work', phaseKey: 'planning' },
      });
      const card = (await deliver({ sourceKey: 'github-issue:1' }))!;
      await putAt(card.id, 'execute');
      recorded.mockClear();

      expect(
        placed((await deliverEvent(card.id, { type: 'pull_request.synchronized', pullRequestTrusted: true })).card),
      ).toEqual({
        board: 'work',
        stages: ['planning'],
      });
      const skips = (await Promise.all(recorded.mock.results.map(result => result.value))).filter(
        record => record.outcome === 'rule_skipped',
      );
      expect(skips).toHaveLength(1);
      expect(await boards.getIntakeDecision(scope, skips[0]!.id)).toMatchObject({
        outcome: 'rule_skipped',
        routeId: broken.id,
        boardKey: 'ship',
        reason: expect.stringContaining('"staging"'),
        sourceKey: 'github-issue:1',
      });
    });
  });

  it('moves nothing without a routes reader under a forced route list', async () => {
    const { route, deliver, deliverEvent } = await setup({ withRoutesReader: false, intakeEvaluator: 'route-list' });
    await route({ name: 'Done', on: ['work_item.closed'], target: { boardKey: 'work', phaseKey: 'done' } });
    const card = (await deliver({ sourceKey: 'github-issue:1' }))!;
    expect((await deliverEvent(card.id, { type: 'work_item.closed', reason: 'completed' })).card).toMatchObject({
      stages: ['intake'],
    });
  });
});

describe('intake routes moving existing cards when labels or assignees change', () => {
  const ADDED = (label: string) => ({
    operator: 'AND' as const,
    conditions: [{ field: 'event.labels.added', operator: 'contains' as const, value: label }],
  });
  const labels = (added: string[], removed: string[] = []) => ({
    type: 'work_item.updated' as const,
    labels: { added, removed },
  });

  async function shipRoute(options: { from?: string } = {}) {
    const harness = await setup();
    const shipping = await harness.route({
      name: 'Ship it',
      on: ['work_item.updated'],
      when: options.from
        ? {
            operator: 'AND',
            conditions: [...ADDED('ship').conditions, { field: 'card.phase', operator: 'equals', value: options.from }],
          }
        : ADDED('ship'),
      target: { boardKey: 'work', phaseKey: 'done' },
    });
    const card = (await harness.deliver({ sourceKey: 'github-issue:1' }))!;
    const card2 = await harness.workItems.get({ orgId: 'org-1', id: card.id });
    return { ...harness, shipping, card: card2! };
  }

  it("moves the card when a person adds the route's label, once the burst window has passed", async () => {
    const { card, commitUpdate, dispatcher, workItems, routeDecisions, shipping } = await shipRoute();

    await commitUpdate(card.id, labels(['ship']), '2030-01-01T00:10:00Z');
    // Within the burst window nothing moves yet, and the wait isn't an attempt.
    await dispatcher.runOnce(new Date('2030-01-01T00:10:01Z'));
    expect(await workItems.get({ orgId: 'org-1', id: card.id })).toMatchObject({ stages: ['intake'] });
    expect(await routeDecisions(card.id)).toEqual(['pending']);

    await dispatcher.runOnce(new Date('2030-01-01T00:10:05Z'));
    const moved = await workItems.get({ orgId: 'org-1', id: card.id });
    expect(moved).toMatchObject({ stages: ['done'] });
    expect(moved!.stageHistory.at(-1)).toMatchObject({ stage: 'done', by: `intake-route:${shipping.id}` });
    expect(await routeDecisions(card.id)).toEqual(['succeeded']);
    // The rule's move changed the card, not its source: it queues no update of its own.
    await dispatcher.runOnce(new Date('2030-01-01T00:11:00Z'));
    const updates = (await workItems.listDeferredDecisions('org-1', card.factoryProjectId, { workItemId: card.id }))
      .map(entry => entry.decision as { type: string; event?: { type: string } })
      .filter(decision => decision.event?.type === 'work_item.updated');
    expect(updates).toHaveLength(1);
  });

  // A burst within the window moves the card once, by the net change; the older updates give way to the newest.
  it.each([
    {
      case: 'carries the net change',
      changes: [
        [['ship'], []],
        [['bug'], []],
        [[], ['bug']],
      ],
      stages: ['done'],
    },
    {
      case: 'moves nothing when it nets out',
      changes: [
        [['ship'], []],
        [[], ['ship']],
      ],
      stages: ['intake'],
    },
  ] as const)('folds a burst of changes into one event that $case', async ({ changes, stages }) => {
    const { card, commitUpdate, dispatcher, workItems, routeDecisions } = await shipRoute();
    for (const [index, [added, removed]] of changes.entries()) {
      await commitUpdate(card.id, labels([...added], [...removed]), `2030-01-01T00:10:0${index}Z`);
    }
    // The newest update is still in its window: nothing moves yet.
    await dispatcher.runOnce(new Date('2030-01-01T00:10:04Z'));
    expect(await workItems.get({ orgId: 'org-1', id: card.id })).toMatchObject({ stages: ['intake'] });

    await dispatcher.runOnce(new Date('2030-01-01T00:10:08Z'));
    expect(await workItems.get({ orgId: 'org-1', id: card.id })).toMatchObject({ stages });
    expect(await routeDecisions(card.id)).toEqual([...changes.slice(1).map(() => 'superseded'), 'succeeded']);
  });

  it('waits for an earlier update still moving the card, even after its lease was renewed', async () => {
    const { card, commitUpdate, dispatcher, workItems, routeDecisions } = await shipRoute();

    await commitUpdate(card.id, labels(['ship']), '2030-01-01T00:10:00Z');
    // Another worker claimed the first update before the second existed, and is still on it.
    const [claimed] = await workItems.claimDeferredDecisions({
      ownerId: 'other-worker',
      now: new Date('2030-01-01T00:10:06Z'),
      leaseExpiresAt: new Date('2030-01-01T00:11:00Z'),
      limit: 10,
    });
    expect(claimed?.workItemId).toBe(card.id);
    await commitUpdate(card.id, labels(['bug']), '2030-01-01T00:10:07Z');
    vi.useFakeTimers({ toFake: ['Date'], now: new Date('2030-01-01T00:10:08Z') });
    try {
      await workItems.renewDeferredDecisionLease(
        { id: claimed!.id, orgId: 'org-1', factoryProjectId: card.factoryProjectId, ownerId: 'other-worker' },
        new Date('2030-01-01T00:12:00Z'),
      );
    } finally {
      vi.useRealTimers();
    }

    await dispatcher.runOnce(new Date('2030-01-01T00:10:20Z'));
    // Folding now would hand `ship` to the card a second time.
    expect(await routeDecisions(card.id)).toEqual(['leased', 'pending']);
  });

  it('starts a new event after the group last moved: an earlier, already applied change is not counted again', async () => {
    const { card, commitUpdate, dispatcher, workItems, putAt } = await shipRoute();

    await commitUpdate(card.id, labels(['ship']), '2030-01-01T00:10:00Z');
    await dispatcher.runOnce(new Date('2030-01-01T00:10:10Z'));
    expect(await workItems.get({ orgId: 'org-1', id: card.id })).toMatchObject({ stages: ['done'] });
    await putAt(card.id, 'intake');

    await commitUpdate(card.id, labels(['bug']), '2030-01-01T00:20:00Z');
    await dispatcher.runOnce(new Date('2030-01-01T00:20:10Z'));
    expect(await workItems.get({ orgId: 'org-1', id: card.id })).toMatchObject({ stages: ['intake'] });
  });

  it("doesn't count again a change whose move committed but whose decision never finished", async () => {
    const { card, commitUpdate, dispatcher, workItems, putAt } = await shipRoute();

    await commitUpdate(card.id, labels(['ship']), '2030-01-01T00:10:00Z');
    const complete = vi
      .spyOn(workItems, 'completeDeferredDecision')
      .mockRejectedValueOnce(new Error('connection lost'));
    await dispatcher.runOnce(new Date('2030-01-01T00:10:10Z'));
    complete.mockRestore();
    expect(await workItems.get({ orgId: 'org-1', id: card.id })).toMatchObject({ stages: ['done'] });
    await putAt(card.id, 'intake');

    await commitUpdate(card.id, labels(['bug']), '2030-01-01T00:20:00Z');
    await dispatcher.runOnce(new Date('2030-01-01T00:30:00Z'));
    expect(await workItems.get({ orgId: 'org-1', id: card.id })).toMatchObject({ stages: ['intake'] });
  });

  it('replays, as dispatch does, only the change after a move that committed but never finished', async () => {
    const { card, commitUpdate, dispatcher, workItems, putAt, boards, scope } = await shipRoute();

    await commitUpdate(card.id, labels(['ship']), '2030-01-01T00:10:00Z');
    const complete = vi
      .spyOn(workItems, 'completeDeferredDecision')
      .mockRejectedValueOnce(new Error('connection lost'));
    await dispatcher.runOnce(new Date('2030-01-01T00:10:10Z'));
    complete.mockRestore();
    await putAt(card.id, 'intake');
    await commitUpdate(card.id, labels(['bug']), '2030-01-01T00:20:00Z');

    const { IntakeCheck } = await import('../routes/intake-check.js');
    const registry = (
      await new ProjectBoardCache({ codeRegistry: createTriageWorkRegistry(), storage: boards, recheckMs: 0 }).describe(
        scope,
      )
    ).registry;
    const { moves } = await new IntakeCheck({ storage: boards, workItems }).test(scope, registry, { itemId: card.id });
    expect(moves[0]).toMatchObject({
      event: { type: 'work_item.updated', labels: { added: ['bug'], removed: [] } },
      outcome: 'stays',
    });

    await dispatcher.runOnce(new Date('2030-01-01T00:30:00Z'));
    expect(await workItems.get({ orgId: 'org-1', id: card.id })).toMatchObject({ stages: ['intake'] });
  });

  it('moves only from the phase a card.phase filter names', async () => {
    const { card, commitUpdate, dispatcher, workItems, putAt } = await shipRoute({ from: 'triage' });

    await commitUpdate(card.id, labels(['ship']), '2030-01-01T00:10:00Z');
    await dispatcher.runOnce(new Date('2030-01-01T00:10:10Z'));
    expect(await workItems.get({ orgId: 'org-1', id: card.id })).toMatchObject({ stages: ['intake'] });

    await putAt(card.id, 'triage');
    await commitUpdate(card.id, labels(['ship']), '2030-01-01T00:20:00Z');
    await dispatcher.runOnce(new Date('2030-01-01T00:20:10Z'));
    expect(await workItems.get({ orgId: 'org-1', id: card.id })).toMatchObject({ stages: ['done'] });
  });

  it("never cancels a close: an update queued after it doesn't overtake it", async () => {
    const { card, commitUpdate, deliverEvent, route, workItems } = await shipRoute();
    await route({ name: 'Closed', on: ['work_item.closed'], target: { boardKey: 'work', phaseKey: 'canceled' } });

    await commitUpdate(card.id, labels(['wontfix']), '2030-01-01T00:00:00Z');
    await deliverEvent(card.id, { type: 'work_item.closed', reason: 'canceled' });

    expect(await workItems.get({ orgId: 'org-1', id: card.id })).toMatchObject({ stages: ['canceled'] });
  });
});

describe('intake routes moving existing cards on pull request events', () => {
  /** A pull request's own card, filed by a trusted author: the default routes send it to PR review. */
  async function pullRequestCard(harness: Awaited<ReturnType<typeof setup>>, board = 'work', stage = 'pr-review') {
    return (await harness.deliver({
      sourceKey: 'github-pr:17',
      source: 'github-pr',
      board,
      stage,
      metadata: { authorTrusted: true },
    }))!;
  }

  it("keeps the default rule's own move, re-entry and message included, where the default route agrees", async () => {
    const harness = await setup({ withDefaultRoute: true });
    const card = await pullRequestCard(harness);
    expect(card.stages).toEqual(['pr-review']);

    const reviewRuns = async () =>
      (await harness.workItems.listDeferredDecisions('org-1', harness.project.id)).filter(
        decision => decision.workItemId === card.id && decision.decision.type === 'invokeSkill',
      ).length;
    const before = await reviewRuns();
    // A push to a pull request in review: the rule re-enters PR review to restart the pass.
    const pushed = await harness.deliverDecision(card.id, {
      type: 'transition',
      idempotencyKey: 'push:re-review-updated',
      board: 'work',
      stage: 'pr-review',
      reenter: true,
      event: { type: 'pull_request.synchronized' },
    });
    // Re-entering the phase it sits in queues a fresh review pass.
    expect(pushed.card).toMatchObject({ stages: ['pr-review'] });
    expect(await reviewRuns()).toBe(before + 1);

    const merged = await harness.deliverDecision(card.id, {
      type: 'transition',
      idempotencyKey: 'merge:pull-request-merged',
      board: 'work',
      stage: 'done',
      message: { text: 'Pull request #17 merged.' },
      event: { type: 'pull_request.merged' },
    });
    expect(merged.card).toMatchObject({ stages: ['done'] });
    expect(merged.card!.stageHistory.at(-1)!.by).not.toMatch(/^intake-route:/);
  });

  it('sends a merged pull request wherever an admin points its route', async () => {
    const harness = await setup({ withDefaultRoute: true });
    const mergedRoute = (await harness.boards.listIntakeRoutes(harness.scope)).find(route =>
      route.on.includes('pull_request.merged'),
    )!;
    await harness.boards.updateIntakeRoute(
      harness.scope,
      mergedRoute.id,
      { target: { boardKey: 'work', phaseKey: 'canceled' } },
      { expectedRevision: mergedRoute.revision, actor: 'admin' },
    );
    const card = await pullRequestCard(harness);

    const merged = await harness.deliverDecision(card.id, {
      type: 'transition',
      idempotencyKey: 'merge:pull-request-merged',
      board: 'work',
      stage: 'done',
      event: { type: 'pull_request.merged' },
    });
    expect(merged.card).toMatchObject({ stages: ['canceled'] });
    expect(merged.card!.stageHistory.at(-1)).toMatchObject({ stage: 'canceled', by: `intake-route:${mergedRoute.id}` });
  });

  it("still finishes a merged card with the rule's own move when the admin disables the merge route", async () => {
    const harness = await setup({ withDefaultRoute: true });
    const mergedRoute = (await harness.boards.listIntakeRoutes(harness.scope)).find(route =>
      route.on.includes('pull_request.merged'),
    )!;
    await harness.boards.updateIntakeRoute(
      harness.scope,
      mergedRoute.id,
      { enabled: false },
      { expectedRevision: mergedRoute.revision, actor: 'admin' },
    );
    const card = await pullRequestCard(harness);

    const merged = await harness.deliverDecision(card.id, {
      type: 'transition',
      idempotencyKey: 'merge:pull-request-merged',
      board: 'work',
      stage: 'done',
      event: { type: 'pull_request.merged' },
    });
    expect(merged.card).toMatchObject({ stages: ['done'] });
    expect(merged.card!.stageHistory.at(-1)!.by).not.toMatch(/^intake-route:/);
  });

  it('moves a finished card on a merge or a close never, and re-reviews it on a push', async () => {
    const harness = await setup({ withDefaultRoute: true });
    const card = await pullRequestCard(harness);
    await harness.putAt(card.id, 'done');

    const closed = await harness.deliverDecision(card.id, {
      type: 'transition',
      idempotencyKey: 'close:pull-request-closed',
      board: 'work',
      stage: 'canceled',
      event: { type: 'pull_request.closed' },
    });
    expect(closed.card).toMatchObject({ stages: ['done'] });

    const pushed = await harness.deliverDecision(card.id, {
      type: 'transition',
      idempotencyKey: 'push:re-review-updated',
      board: 'work',
      stage: 'pr-review',
      event: { type: 'pull_request.synchronized' },
    });
    expect(pushed.card).toMatchObject({ stages: ['pr-review'] });
  });

  it('moves a pull request card on a board with no pull request loop only where a route naming the event says', async () => {
    const harness = await setup();
    await harness.boards.create(harness.scope, docsBoard, 'admin');
    await harness.route({ name: 'Pull requests to Docs', target: { boardKey: 'docs' } });
    const card = await pullRequestCard(harness, 'docs', 'inbox');
    expect(placed(card)).toEqual({ board: 'docs', stages: ['inbox'] });

    expect((await harness.deliverEvent(card.id, { type: 'pull_request.merged' })).card).toMatchObject({
      stages: ['inbox'],
    });

    const route = await harness.route({
      name: 'Merged docs ship',
      on: ['pull_request.merged'],
      target: { boardKey: 'docs', phaseKey: 'published' },
    });
    const merged = (await harness.deliverEvent(card.id, { type: 'pull_request.merged' })).card;
    expect(merged).toMatchObject({ stages: ['published'] });
    expect(merged!.stageHistory.at(-1)).toMatchObject({ stage: 'published', by: `intake-route:${route.id}` });
  });
});

describe('which evaluator decides a project’s arrivals', () => {
  const docsRule = { name: 'Docs', when: DOCS, target: { boardKey: 'docs', phaseKey: null } };
  /** A project whose only rule takes docs items; a bug report matches nothing. */
  async function docsOnly(options: Parameters<typeof setup>[0] = {}) {
    const seeded = await setup(options);
    await seeded.boards.create(seeded.scope, docsBoard, 'admin');
    await seeded.route(docsRule);
    return seeded;
  }
  const bug = { sourceKey: 'github-issue:7', metadata: { labels: ['bug'] } };

  it('decides a project created now by intake order with nothing forcing it', async () => {
    const seeded = await docsOnly({ project: 'new' });

    expect(await seeded.deliver(bug)).toBeUndefined();
    expect((await seeded.boards.listNotRouted(seeded.scope)).notRouted).toMatchObject([
      { sourceKey: 'github-issue:7', evaluator: 'intake-order' },
    ]);
  });

  it('keeps a project from before the setting on the route list, which files an unmatched item on Work', async () => {
    const seeded = await docsOnly({ project: 'older' });

    expect(placed(await seeded.deliver(bug))).toEqual({ board: 'work', stages: ['intake'] });
  });

  it('lets a forced evaluator win over the project’s setting, either way', async () => {
    const forcedOld = await docsOnly({ project: 'new', intakeEvaluator: 'route-list' });
    expect(placed(await forcedOld.deliver(bug))).toEqual({ board: 'work', stages: ['intake'] });

    const forcedNew = await docsOnly({ project: 'older', intakeEvaluator: 'intake-order' });
    expect(await forcedNew.deliver(bug)).toBeUndefined();
  });

  it('decides the next arrival by the evaluator an older project is switched to', async () => {
    const seeded = await docsOnly({ project: 'older' });
    await seeded.boards.setIntakeEvaluator(seeded.scope, 'intake-order');

    expect(await seeded.deliver(bug)).toBeUndefined();
  });
});

describe('intake by intake order', () => {
  const docsRule = { name: 'Docs', when: DOCS, target: { boardKey: 'docs', phaseKey: null } };
  const everything = { name: 'Everything else', when: null, target: { boardKey: 'work', phaseKey: null } };

  it.each(['route-list', 'intake-order'] as const)(
    "files each arrival on the same board under %s when each board's rules sit together",
    async intakeEvaluator => {
      const seeded = await setup({ intakeEvaluator });
      await seeded.boards.create(seeded.scope, docsBoard, 'admin');
      await seeded.route(docsRule);
      await seeded.route(everything);

      const docs = await seeded.deliver({ sourceKey: 'github-issue:1', metadata: { labels: ['docs'] } });
      const other = await seeded.deliver({ sourceKey: 'github-issue:2', metadata: { labels: ['bug'] } });

      expect(placed(docs)).toEqual({ board: 'docs', stages: ['inbox'] });
      expect(placed(other)).toEqual({ board: 'work', stages: ['intake'] });
    },
  );

  it('asks each board in intake order, so an interleaved list places by board, not by line', async () => {
    const seeded = await setup({ intakeEvaluator: 'intake-order' });
    await seeded.boards.create(seeded.scope, docsBoard, 'admin');
    await seeded.route(everything);
    await seeded.route(docsRule);
    await seeded.boards.setIntakeOrder(seeded.scope, ['docs', 'work'], { boards: ['work', 'docs'] });

    const docs = await seeded.deliver({ sourceKey: 'github-issue:1', metadata: { labels: ['docs'] } });
    const other = await seeded.deliver({ sourceKey: 'github-issue:2', metadata: { labels: ['bug'] } });

    expect(placed(docs)).toEqual({ board: 'docs', stages: ['inbox'] });
    expect(placed(other)).toEqual({ board: 'work', stages: ['intake'] });
  });

  it('files no card for an arrival no board takes, and records it Not routed with the arrival', async () => {
    const seeded = await setup({ intakeEvaluator: 'intake-order' });
    await seeded.boards.create(seeded.scope, docsBoard, 'admin');
    await seeded.route(docsRule);

    const card = await seeded.deliver({ sourceKey: 'github-issue:9', metadata: { labels: ['bug'] } });

    expect(card).toBeUndefined();
    expect(await seeded.workItems.list(seeded.scope)).toEqual([]);
    const [notRouted, ...rest] = (await seeded.boards.listNotRouted(seeded.scope)).notRouted;
    expect(rest).toEqual([]);
    expect(notRouted).toMatchObject({
      outcome: 'not_routed',
      evaluator: 'intake-order',
      sourceKey: 'github-issue:9',
      title: 'Issue github-issue:9',
      reason: expect.stringContaining("No board's intake rules match it"),
      arrival: { type: 'upsertLinkedWorkItem', sourceKey: 'github-issue:9' },
      resolvedAt: null,
    });
    // The arrival's decision is done; nothing is left to retry.
    const decisions = await seeded.workItems.listDeferredDecisions('org-1', seeded.project.id);
    expect(decisions.every(decision => decision.status !== 'pending')).toBe(true);
  });

  it('marks the Not routed record resolved once the item is filed after a rule is fixed', async () => {
    const seeded = await setup({ intakeEvaluator: 'intake-order' });
    expect(await seeded.deliver({ sourceKey: 'github-issue:9', metadata: { labels: ['bug'] } })).toBeUndefined();
    await seeded.route(everything);

    const card = await seeded.deliver({ sourceKey: 'github-issue:9', metadata: { labels: ['bug'] } });

    expect(placed(card)).toEqual({ board: 'work', stages: ['intake'] });
    expect((await seeded.boards.listNotRouted(seeded.scope)).notRouted).toEqual([]);
  });

  it('resolves the Not routed record on a retry when resolving failed after the card was filed', async () => {
    const seeded = await setup({ intakeEvaluator: 'intake-order' });
    expect(await seeded.deliver({ sourceKey: 'github-issue:9', metadata: { labels: ['bug'] } })).toBeUndefined();
    await seeded.route(everything);
    vi.spyOn(seeded.boards, 'resolveNotRouted').mockRejectedValueOnce(new Error('storage unavailable'));

    const card = await seeded.deliver({ sourceKey: 'github-issue:9', metadata: { labels: ['bug'] } });
    expect(placed(card)).toEqual({ board: 'work', stages: ['intake'] });
    expect((await seeded.boards.listNotRouted(seeded.scope)).notRouted).toHaveLength(1);

    await seeded.retry();
    expect((await seeded.boards.listNotRouted(seeded.scope)).notRouted).toEqual([]);
    expect(await seeded.workItems.list(seeded.scope)).toHaveLength(1);
  });

  it("files nothing while the project's evaluator setting cannot be read, then files it once the boards domain is back", async () => {
    // As when the boards domain failed to initialize: no intake rules, no evaluator setting, nothing forced.
    const seeded = await setup({ withRoutesReader: false, project: 'new' });
    await seeded.boards.create(seeded.scope, docsBoard, 'admin');
    await seeded.boards.createIntakeRoute(
      seeded.scope,
      { name: 'Docs', target: { boardKey: 'docs' }, when: DOCS },
      'admin',
    );
    expect(await seeded.deliver({ sourceKey: 'github-issue:9', metadata: { labels: ['docs'] } })).toBeUndefined();
    await seeded.retry();
    expect(await seeded.workItems.list(seeded.scope)).toEqual([]);
    const [waiting] = await seeded.workItems.listDeferredDecisions('org-1', seeded.project.id);
    expect(waiting).toMatchObject({ status: 'retry', lastError: expect.stringContaining('unavailable') });

    seeded.recover();
    await seeded.retry(new Date('2030-01-09T00:00:00Z'));
    const cards = await seeded.workItems.list(seeded.scope);
    expect(cards.map(placed)).toEqual([{ board: 'docs', stages: ['inbox'] }]);
  });

  it("keeps an older project's arrival waiting too while its setting cannot be read", async () => {
    const seeded = await setup({ withRoutesReader: false, withDefaultRoute: true });
    expect(await seeded.deliver({ sourceKey: 'github-issue:9', metadata: { labels: ['bug'] } })).toBeUndefined();
    expect(await seeded.workItems.list(seeded.scope)).toEqual([]);
  });

  it('dry-runs every arrival onto the board, phase and rule the dispatcher filed it with', async () => {
    const seeded = await setup({ intakeEvaluator: 'intake-order' });
    await seeded.boards.create(seeded.scope, docsBoard, 'admin');
    await seeded.route({ name: 'Trusted', when: TRUSTED, target: { boardKey: 'work', phaseKey: 'triage' } });
    await seeded.route(PULL_REQUEST_INTAKE_ROUTE);
    await seeded.route(docsRule);
    await seeded.route({
      name: 'Bugs',
      when: { operator: 'AND', conditions: [{ field: 'item.labels', operator: 'contains', value: 'bug' }] },
      target: { boardKey: 'work', phaseKey: null },
    });
    await seeded.boards.setIntakeOrder(seeded.scope, ['docs', 'work'], { boards: ['work', 'docs'] });
    const arrivals: (Partial<LinkedDecision> & { sourceKey: string })[] = [
      { sourceKey: 'github-issue:1', metadata: { labels: ['docs'] } },
      { sourceKey: 'github-issue:2', metadata: { labels: ['bug'] } },
      { sourceKey: 'github-issue:3', metadata: { labels: ['docs', 'bug'], authorTrusted: true } },
      { sourceKey: 'github-issue:4', metadata: { labels: ['question'] } },
      { sourceKey: 'github-issue:5', metadata: { labels: [], authorTrusted: true } },
      { sourceKey: 'github-pr:6', source: 'github-pr', stage: 'pr-review', metadata: { labels: ['bug'] } },
      { sourceKey: 'github-pr:7', source: 'github-pr', stage: 'pr-review', metadata: { labels: ['docs'] } },
    ];
    for (const arrival of arrivals) await seeded.deliver(arrival);

    const { IntakeCheck } = await import('../routes/intake-check.js');
    const registry = (
      await new ProjectBoardCache({
        codeRegistry: createTriageWorkRegistry(),
        storage: seeded.boards,
        recheckMs: 0,
      }).describe(seeded.scope)
    ).registry;
    const result = await new IntakeCheck({ storage: seeded.boards, workItems: seeded.workItems }).dryRun(
      seeded.scope,
      registry,
      {},
    );
    expect(result.sampled).toBe(arrivals.length);
    const cards = await seeded.workItems.list(seeded.scope);
    const notRouted = (await seeded.boards.listNotRouted(seeded.scope)).notRouted;
    expect(cards.length + notRouted.length).toBe(arrivals.length);
    expect(notRouted.length).toBeGreaterThan(0);
    // The fixture files on both boards, in more than one phase, by more than one rule.
    expect(
      new Set(cards.map(card => `${card.board}:${card.stages[0]}:${card.metadata?.intakeRouteId}`)).size,
    ).toBeGreaterThan(3);
    for (const item of result.items) {
      const card = cards.find(entry => entry.externalSource?.externalId === item.key);
      if (card) {
        expect(item.placement, item.key).toEqual({
          boardKey: card.board,
          phase: card.stages[0],
          routeId: card.metadata?.intakeRouteId,
        });
      } else {
        expect(notRouted.map(entry => entry.sourceKey)).toContain(item.key);
        expect(item.placement, item.key).toBeNull();
      }
    }
    // The decision log counts what each rule filed.
    const filed = result.boards.flatMap(board => board.rules).reduce((sum, rule) => sum + rule.filed!, 0);
    expect(filed).toBe(cards.length);
  });
});

describe('the tester replaying card moves', () => {
  it('predicts, before the dispatcher files it, every card move the dispatcher then makes', async () => {
    const seeded = await setup();
    await seeded.boards.create(seeded.scope, docsBoard, 'admin');
    const docsAdded = await seeded.route({
      name: 'Docs added',
      on: ['work_item.updated'],
      when: { operator: 'AND', conditions: [{ field: 'event.labels.added', operator: 'contains', value: 'docs' }] },
      target: { boardKey: 'work', moveToBoardKey: 'docs', phaseKey: null },
    });
    await seeded.route({
      name: 'Closed as completed',
      on: ['work_item.closed'],
      when: CLOSED_AS('completed'),
      target: { boardKey: 'work', phaseKey: 'done' },
    });
    await seeded.route({
      name: 'Reopened',
      on: ['work_item.reopened'],
      target: { boardKey: 'work', phaseKey: 'intake' },
    });
    await seeded.route({
      name: 'Triaged in intake',
      on: ['work_item.updated'],
      when: { operator: 'AND', conditions: [{ field: 'card.phase', operator: 'equals', value: 'intake' }] },
      target: { boardKey: 'work', phaseKey: 'triage' },
    });
    const cases: { event: BoardEventFacts; at?: string }[] = [
      { event: { type: 'work_item.updated', labels: { added: ['docs'], removed: [] } } },
      { event: { type: 'work_item.updated', labels: { added: ['bug'], removed: [] } } },
      { event: { type: 'work_item.updated', assignees: { added: ['ada'], removed: [] } }, at: 'done' },
      { event: { type: 'work_item.closed', reason: 'completed' } },
      { event: { type: 'work_item.closed', reason: 'canceled' } },
      { event: { type: 'work_item.reopened' } },
      { event: { type: 'work_item.reopened' }, at: 'done' },
      // No rule on Work handles a merge: the integration's own move, here none, decides.
      { event: { type: 'pull_request.merged', pullRequestTrusted: true } },
    ];
    const { IntakeCheck } = await import('../routes/intake-check.js');
    const registry = (
      await new ProjectBoardCache({
        codeRegistry: createTriageWorkRegistry(),
        storage: seeded.boards,
        recheckMs: 0,
      }).describe(seeded.scope)
    ).registry;
    const check = new IntakeCheck({ storage: seeded.boards, workItems: seeded.workItems });
    const predicted: { id: string; replay: Awaited<ReturnType<typeof check.test>>['moves'][number] }[] = [];
    for (const [index, { event, at }] of cases.entries()) {
      const card = (await seeded.deliver({ sourceKey: `github-issue:${index + 1}` }))!;
      if (at) await seeded.putAt(card.id, at);
      await seeded.commitUpdate(card.id, event, '2030-01-01T00:00:00Z');
      const [replay] = (await check.test(seeded.scope, registry, { itemId: card.id })).moves;
      predicted.push({ id: card.id, replay: replay! });
    }
    await seeded.retry(new Date('2030-01-02T00:00:00Z'));

    const outcomes = new Set<string>();
    for (const { id, replay } of predicted) {
      const card = (await seeded.workItems.get({ orgId: 'org-1', id }))!;
      outcomes.add(replay.outcome);
      if (replay.outcome === 'moves') {
        expect(placed(card)).toEqual({ board: replay.to!.boardKey, stages: [replay.to!.phase] });
        expect(card.stageHistory.at(-1)).toMatchObject({ by: `intake-route:${replay.to!.routeId}` });
      } else {
        expect(card.stageHistory.at(-1)?.by ?? '').not.toMatch(/^intake-route:/);
      }
    }
    expect(predicted[0]!.replay.to).toMatchObject({ boardKey: 'docs', routeId: docsAdded.id });
    expect(outcomes).toEqual(new Set(['moves', 'stays', 'ignored', 'rule_default']));
  });
});

describe('the tester on issues and pull requests arriving apart', () => {
  /**
   * Asks the tester where an arrival would go by its URL, as for an item Factory hasn't seen: the
   * lookup reads the same facts intake would, then the arrival is delivered and filed for real.
   */
  async function harness(options: Parameters<typeof setup>[0]) {
    const seeded = await setup(options);
    await seeded.boards.create(seeded.scope, docsBoard, 'admin');
    const { IntakeCheck } = await import('../routes/intake-check.js');
    const registry = async () =>
      (
        await new ProjectBoardCache({
          codeRegistry: createTriageWorkRegistry(),
          storage: seeded.boards,
          recheckMs: 0,
        }).describe(seeded.scope)
      ).registry;
    let pending: LinkedDecision | undefined;
    const check = new IntakeCheck({
      storage: seeded.boards,
      workItems: seeded.workItems,
      lookups: [
        {
          lookup: async (_scope, url) => {
            if (!pending || url !== pending.url) return undefined;
            const facts = await arrivalRuleFacts(pending, {
              factoryProjectId: seeded.scope.factoryProjectId,
              registry: await registry(),
              card: id => seeded.workItems.get({ orgId: 'org-1', id }),
            });
            return { status: 'found', title: pending.title, url, facts };
          },
        },
      ],
    });
    const test = async (body: Parameters<typeof check.test>[2]) => check.test(seeded.scope, await registry(), body);
    /** The tester's answer for an arrival not yet delivered, then where filing put it. */
    const arrive = async (arrival: Partial<LinkedDecision> & { sourceKey: string }) => {
      pending = {
        type: 'upsertLinkedWorkItem',
        idempotencyKey: `predict-${arrival.sourceKey}`,
        board: 'work',
        source: 'github-pr',
        title: `Pull request ${arrival.sourceKey}`,
        stage: 'intake',
        url: `https://example.com/${arrival.sourceKey}`,
        metadata: {},
        ...arrival,
      } as LinkedDecision;
      const predicted = await test({ url: pending.url! });
      const card = await seeded.deliver({ source: 'github-pr', ...arrival });
      return { predicted: predicted.placement, filed: card ? placed(card) : null, card };
    };
    return { ...seeded, test, arrive };
  }
  const asFiled = (placement: { boardKey: string; phase: string } | null) =>
    placement && { board: placement.boardKey, stages: [placement.phase] };
  const SHIP: RuleGroup = {
    operator: 'AND',
    conditions: [{ field: 'item.labels', operator: 'contains', value: 'ship' }],
  };

  it("files a new project's card-less pull request in Work › PR review, or Intake from an outside author, as the tester says", async () => {
    const { arrive } = await harness({ project: 'new', withDefaultRoute: true });
    const trusted = await arrive({ sourceKey: 'github-pr:1', metadata: { authorTrusted: true, state: 'open' } });
    const outside = await arrive({ sourceKey: 'github-pr:2', metadata: { authorTrusted: false, state: 'open' } });
    expect(trusted.filed).toEqual({ board: 'work', stages: ['pr-review'] });
    expect(outside.filed).toEqual({ board: 'work', stages: ['intake'] });
    expect(asFiled(trusted.predicted)).toEqual(trusted.filed);
    expect(asFiled(outside.predicted)).toEqual(outside.filed);
  });

  it("files pull requests by an older project's legacy route that names both arrivals, and passes over issue-only and pull-request-only rules for the other kind", async () => {
    const { route, test, arrive } = await harness({ intakeEvaluator: 'intake-order' });
    const issuesOnly = await route({
      name: 'Issues',
      on: ['work_item.opened'],
      target: { boardKey: 'work', phaseKey: null },
    });
    const legacy = await route({
      name: 'Anything new',
      on: ['work_item.created'],
      target: { boardKey: 'docs', phaseKey: null },
    });
    const pr = await arrive({ sourceKey: 'github-pr:3', metadata: { state: 'open' } });
    expect(pr.filed).toEqual({ board: 'docs', stages: ['inbox'] });
    expect(asFiled(pr.predicted)).toEqual(pr.filed);
    const traced = await test({ itemId: pr.card!.id });
    const work = traced.boards.find(board => board.boardKey === 'work')!;
    expect(work.rules.find(rule => rule.routeId === issuesOnly.id)).toMatchObject({
      outcome: 'no_match',
      failed: [{ field: 'source.kind', operator: 'not_equals', value: 'pull_request', actual: 'pull_request' }],
    });
    expect(traced.placement).toMatchObject({ boardKey: 'docs', routeId: legacy.id });
  });

  it('files a Not routed pull request once it is labelled or reopened, where the tester says, and not before', async () => {
    const { route, test, arrive, boards, scope } = await harness({ intakeEvaluator: 'intake-order' });
    const shipping = await route({
      name: 'Ship it',
      on: ['pull_request.opened'],
      when: SHIP,
      target: { boardKey: 'docs', phaseKey: null },
    });
    const unlabelled = await arrive({ sourceKey: 'github-pr:4', metadata: { labels: [], state: 'open' } });
    expect(unlabelled.filed).toBeNull();
    expect(unlabelled.predicted).toBeNull();
    const [recorded] = (await boards.listNotRouted(scope)).notRouted;
    expect((await test({ itemId: recorded!.id })).placement).toBeNull();

    // Labelled while open: the integration takes it in again as an opened pull request.
    const labelled = await arrive({ sourceKey: 'github-pr:4', metadata: { labels: ['ship'], state: 'open' } });
    expect(labelled.filed).toEqual({ board: 'docs', stages: ['inbox'] });
    expect(labelled.predicted).toMatchObject({ boardKey: 'docs', routeId: shipping.id });

    // Reopened after closing Not routed: taken in again too, and filed once a rule takes it.
    expect((await arrive({ sourceKey: 'github-pr:5', metadata: { labels: [], state: 'open' } })).filed).toBeNull();
    await route({ name: 'Reopened work', on: ['pull_request.opened'], target: { boardKey: 'work', phaseKey: null } });
    const reopened = await arrive({ sourceKey: 'github-pr:5', metadata: { labels: [], state: 'open' } });
    expect(reopened.filed).toEqual({ board: 'work', stages: ['intake'] });
    expect(asFiled(reopened.predicted)).toEqual(reopened.filed);
  });

  it('moves a pull request card on a label change by a pull_request.updated rule, as the tester replays it', async () => {
    const { route, test, arrive, deliverEvent } = await harness({ intakeEvaluator: 'intake-order' });
    await route({ name: 'Pull requests', on: ['pull_request.opened'], target: { boardKey: 'work', phaseKey: null } });
    const shipped = await route({
      name: 'Shipping',
      on: ['pull_request.updated'],
      when: { operator: 'AND', conditions: [{ field: 'event.labels.added', operator: 'contains', value: 'ship' }] },
      target: { boardKey: 'work', moveToBoardKey: 'docs', phaseKey: null },
    });
    await route({
      name: 'Issue labels',
      on: ['work_item.updated'],
      target: { boardKey: 'work', phaseKey: 'done' },
    });
    const { card } = await arrive({ sourceKey: 'github-pr:6', metadata: { state: 'open' } });
    const event: BoardEventFacts = { type: 'pull_request.updated', labels: { added: ['ship'], removed: [] } };
    const [replay] = (await test({ itemId: card!.id, event })).moves;
    expect(replay).toMatchObject({ outcome: 'moves', to: { boardKey: 'docs', phase: 'inbox', routeId: shipped.id } });
    const moved = (await deliverEvent(card!.id, event)).card!;
    expect(placed(moved)).toEqual({ board: 'docs', stages: ['inbox'] });
  });

  it('sends an issue card to PR review when its own pull request opens, as the tester replays the pending move', async () => {
    const { test, deliver, workItems, scope, retry } = await harness({ project: 'new', withDefaultRoute: true });
    const issue = (await deliver({ sourceKey: 'github-issue:7', metadata: { authorTrusted: true } }))!;
    await workItems.attachSource({
      orgId: 'org-1',
      id: issue.id,
      source: {
        integrationId: 'github',
        type: 'pull-request',
        externalId: 'github:1:pull-request:8',
        url: 'https://example.com/github-pr:8',
      },
      metadata: { githubPullRequestNumber: 8, state: 'open' },
    });
    const card = (await workItems.get({ orgId: 'org-1', id: issue.id }))!;
    // The integration's own move for the card's pull request, carrying the event, not yet dispatched.
    await workItems.commitRuleEvaluation({
      ...scope,
      workItemId: card.id,
      ingress: { identity: 'out-for-review' },
      configVersion: 'intake-routes-v1',
      expectedRevision: card.revision,
      actor: { type: 'system', id: 'rules' },
      outcome: { status: 'accepted' },
      decisions: [
        {
          type: 'transition',
          idempotencyKey: 'out-for-review:move',
          board: 'work',
          stage: 'pr-review',
          event: { type: 'pull_request.opened', pullRequestTrusted: true },
        },
      ],
      causalChain: [],
      now: new Date('2030-01-01T00:00:00Z'),
    });
    const [replay] = (await test({ itemId: card.id })).moves;
    expect(replay).toMatchObject({ event: { type: 'pull_request.opened' } });
    await retry();
    const moved = (await workItems.get({ orgId: 'org-1', id: card.id }))!;
    expect(placed(moved)).toEqual({ board: 'work', stages: ['pr-review'] });
    const answer =
      replay!.outcome === 'moves'
        ? replay!.to
        : replay!.outcome === 'rule_default'
          ? { boardKey: 'work', phase: replay!.phase! }
          : null;
    expect(asFiled(answer)).toEqual(placed(moved));
  });
});

describe('the tester replaying a burst of updates', () => {
  it('folds pending updates the way the dispatcher does, so it predicts the one move dispatch makes', async () => {
    const seeded = await setup();
    await seeded.boards.create(seeded.scope, docsBoard, 'admin');
    const labelAdded = (label: string) => ({
      operator: 'AND' as const,
      conditions: [{ field: 'event.labels.added', operator: 'contains' as const, value: label }],
    });
    // Bug added sits first: replayed one by one, the middle update would send the card to Triage.
    await seeded.route({
      name: 'Bug added',
      on: ['work_item.updated'],
      when: labelAdded('bug'),
      target: { boardKey: 'work', phaseKey: 'triage' },
    });
    const docsAdded = await seeded.route({
      name: 'Docs added',
      on: ['work_item.updated'],
      when: labelAdded('docs'),
      target: { boardKey: 'work', moveToBoardKey: 'docs', phaseKey: null },
    });
    const card = (await seeded.deliver({ sourceKey: 'github-issue:1' }))!;
    await seeded.commitUpdate(
      card.id,
      { type: 'work_item.updated', labels: { added: ['docs'], removed: [] } },
      '2030-01-01T00:00:00.000Z',
    );
    await seeded.commitUpdate(
      card.id,
      { type: 'work_item.updated', labels: { added: ['bug'], removed: [] } },
      '2030-01-01T00:00:01.000Z',
    );
    await seeded.commitUpdate(
      card.id,
      { type: 'work_item.updated', labels: { added: [], removed: ['bug'] } },
      '2030-01-01T00:00:02.000Z',
    );

    const { IntakeCheck } = await import('../routes/intake-check.js');
    const registry = (
      await new ProjectBoardCache({
        codeRegistry: createTriageWorkRegistry(),
        storage: seeded.boards,
        recheckMs: 0,
      }).describe(seeded.scope)
    ).registry;
    const { moves } = await new IntakeCheck({ storage: seeded.boards, workItems: seeded.workItems }).test(
      seeded.scope,
      registry,
      { itemId: card.id },
    );
    expect(moves).toHaveLength(1);
    expect(moves[0]).toMatchObject({
      event: { type: 'work_item.updated', labels: { added: ['docs'], removed: [] } },
      outcome: 'moves',
      to: { boardKey: 'docs', phase: 'inbox', routeId: docsAdded.id },
    });

    await seeded.retry(new Date('2030-01-02T00:00:00Z'));
    const moved = (await seeded.workItems.get({ orgId: 'org-1', id: card.id }))!;
    expect(placed(moved)).toEqual({ board: 'docs', stages: ['inbox'] });
    expect(moved.stageHistory.at(-1)).toMatchObject({ by: `intake-route:${docsAdded.id}` });

    // A burst that ends where it started moves nothing, on dispatch or in the tester.
    const other = (await seeded.deliver({ sourceKey: 'github-issue:2' }))!;
    await seeded.commitUpdate(
      other.id,
      { type: 'work_item.updated', labels: { added: ['bug'], removed: [] } },
      '2030-01-03T00:00:00.000Z',
    );
    await seeded.commitUpdate(
      other.id,
      { type: 'work_item.updated', labels: { added: [], removed: ['bug'] } },
      '2030-01-03T00:00:01.000Z',
    );
    const netted = await new IntakeCheck({ storage: seeded.boards, workItems: seeded.workItems }).test(
      seeded.scope,
      registry,
      { itemId: other.id },
    );
    expect(netted.moves.map(move => move.outcome)).toEqual(['ignored']);
    await seeded.retry(new Date('2030-01-04T00:00:00Z'));
    expect(placed((await seeded.workItems.get({ orgId: 'org-1', id: other.id }))!)).toEqual({
      board: 'work',
      stages: ['intake'],
    });
  });
});
