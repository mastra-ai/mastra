import { RequestContext } from '@mastra/core/request-context';
import type { FactoryStorage } from '@mastra/core/storage';
import { LibSQLFactoryStorage } from '@mastra/libsql';
import { describe, expect, it, vi } from 'vitest';
import { createBoardRegistry } from '../../boards/index.js';
import { ProjectBoardCache } from '../../boards/project-boards.js';

import { createTriageWorkRegistry } from '../../boards/test-utils.js';
import { workSeedWithSelfReview } from '../../boards/work-migrations.js';
import { FactoryDecisionDispatcher } from '../../rules/dispatcher.js';
import { createFactoryTransitionTools } from '../../rules/tools.js';
import { FactoryTransitionService } from '../../rules/transition-service.js';
import type { StoredBoardInput } from '../../storage/domains/boards/base.js';
import { createFactoryStorageForTests, createIsolatedFactoryPostgresForTests } from '../../storage/test-utils.js';
import { resolveGithubRules } from './default-rules.js';
import { GithubRules } from './rules.js';

/**
 * The whole pull request loop, driven through the GitHub rules and the real dispatcher, on a
 * board an admin stored with phase names of its own. Nothing about it is Work's: the loop runs
 * because its phases say what they do (who runs them, which Factory tools they grant).
 */
const shipBoard: StoredBoardInput = {
  key: 'ship',
  name: 'Ship',
  phases: [
    // Pull requests a route files here go straight on to review, as Work's Intake lets them.
    { key: 'inbox', name: 'Inbox', kind: 'resting', nextPhases: ['think', 'make', 'pr', 'dropped'] },
    {
      key: 'think',
      name: 'Think',
      kind: 'working',
      runner: { context: 'triage', skill: 'factory-triage' },
      nextPhases: ['inbox', 'make', 'dropped'],
    },
    {
      key: 'make',
      name: 'Make',
      kind: 'working',
      runner: { context: 'work', skill: 'factory-build' },
      nextPhases: ['check', 'pr', 'dropped'],
    },
    {
      key: 'check',
      name: 'Check',
      kind: 'working',
      runner: { context: 'review', skill: 'factory-self-review' },
      tools: ['factory_record_review_verdict'],
      nextPhases: ['make', 'pr', 'inbox'],
    },
    {
      key: 'pr',
      name: 'PR',
      kind: 'working',
      runner: { context: 'review', skill: 'factory-review' },
      tools: ['factory_review_source', 'factory_record_review_verdict'],
      nextPhases: ['make', 'inbox', 'shipped', 'dropped'],
    },
    { key: 'shipped', name: 'Shipped', kind: 'terminal' },
    { key: 'dropped', name: 'Dropped', kind: 'terminal' },
  ],
};

/** The same parts of the loop on each board, by that board's own keys. */
interface Loop {
  name: string;
  board: string;
  rest: string;
  toBuild: readonly string[];
  build: string;
  /** The board's self-review phase; Work has none. */
  selfReview?: string;
  review: string;
  completed: string;
  canceled: string;
  /** The project's Work row was stored while Work still had its self-review phase. */
  storedWithSelfReview?: true;
}

const work = {
  board: 'work',
  rest: 'intake',
  toBuild: ['planning', 'execute'],
  build: 'execute',
  review: 'pr-review',
  completed: 'done',
  canceled: 'canceled',
} as const;

const LOOPS: readonly Loop[] = [
  {
    name: 'a custom board with its own self-review phase',
    board: 'ship',
    rest: 'inbox',
    toBuild: ['make'],
    build: 'make',
    selfReview: 'check',
    review: 'pr',
    completed: 'shipped',
    canceled: 'dropped',
  },
  { name: "a new project's Work board, which has no self-review phase", ...work },
  {
    name: 'a Work board stored while Work still had its self-review phase',
    ...work,
    selfReview: 'review',
    storedWithSelfReview: true,
  },
];

const SHA = 'abc1234def000000000000000000000000000000';
const postgresUrl = process.env.FACTORY_TEST_POSTGRES_URL;

function issueOpened() {
  return {
    event: 'issues',
    deliveryId: 'delivery-issue',
    payload: {
      action: 'opened',
      installation: { id: 7 },
      repository: { id: 10, full_name: 'acme/repo' },
      sender: { login: 'maintainer' },
      issue: {
        number: 42,
        title: 'Issue 42',
        html_url: 'https://github.com/acme/repo/issues/42',
        created_at: '2030-01-01T00:00:00Z',
      },
    },
  };
}

function pullRequest(action: 'opened' | 'synchronize' | 'closed', deliveryId: string, merged = false) {
  return {
    event: 'pull_request',
    deliveryId,
    payload: {
      action,
      installation: { id: 7 },
      repository: { id: 10, full_name: 'acme/repo' },
      sender: { login: 'maintainer' },
      pull_request: {
        number: 17,
        title: 'PR 17',
        html_url: 'https://github.com/acme/repo/pull/17',
        created_at: '2030-01-01T00:00:00Z',
        state: action === 'closed' ? 'closed' : 'open',
        merged,
        head: { ref: 'factory/issue-42', sha: SHA },
        base: { ref: 'main' },
      },
    },
  };
}

async function harness(
  backend: string,
  loop: Loop,
  ship: StoredBoardInput = shipBoard,
  /** The phase the project's route files issues in; the board's initial phase when unset. */
  issuePhase?: string,
) {
  const storage: FactoryStorage =
    backend === 'postgres'
      ? await createIsolatedFactoryPostgresForTests(postgresUrl!)
      : new LibSQLFactoryStorage({ id: `any-board-pr-loop-${loop.board}-${loop.selfReview}`, url: ':memory:' });
  const seeded = await createFactoryStorageForTests(storage);
  const workItems = seeded.workItems;
  const sourceControl = seeded.sourceControl.forIntegration('github');
  const integrationStorage = seeded.integrations.forIntegration<
    Record<string, unknown>,
    Record<string, unknown>,
    { kind: 'factory-pr-provenance'; factoryProjectId: string; workItemId: string }
  >('github');
  const project = await seeded.projects.create({ orgId: 'org-1', userId: 'user-1', input: { name: 'Loop' } });
  const scope = { orgId: 'org-1', factoryProjectId: project.id };
  const installation = await sourceControl.installations.upsert({
    orgId: 'org-1',
    connectedByUserId: 'user-1',
    externalId: '7',
  });
  const repository = await sourceControl.repositories.upsert({
    orgId: 'org-1',
    input: { installationId: installation.id, externalId: '10', slug: 'acme/repo', defaultBranch: 'main' },
  });
  const connection = await sourceControl.connections.create({
    orgId: 'org-1',
    factoryProjectId: project.id,
    installationId: installation.id,
    createdByUserId: 'user-1',
  });
  await sourceControl.projectRepositories.link({
    orgId: 'org-1',
    connectionId: connection.id,
    repositoryId: repository.id,
    createdByUserId: 'user-1',
    sandboxProvider: 'local',
    sandboxWorkdir: '/workspace',
  });

  if (loop.storedWithSelfReview) {
    // The project's Work row as Factory stored it back then: its row is its board from then on.
    await seeded.boards.insertIfMissing(scope, workSeedWithSelfReview(), 'factory');
  }
  // Factory's own registry, as production runs; the stored-with-self-review loop walks that old row,
  // Triage included.
  const codeRegistry = loop.storedWithSelfReview ? createTriageWorkRegistry() : createBoardRegistry();
  const boards = new ProjectBoardCache({ codeRegistry, storage: seeded.boards, recheckMs: 0 });
  if (loop.board === 'work' && !loop.storedWithSelfReview) {
    // A project created now: the create route stores today's Work, which has no Triage.
    await boards.seedNewProject(scope);
    const work = await seeded.boards.get(scope, 'work');
    expect(work!.phases.map(phase => phase.key)).not.toContain('triage');
  }
  if (loop.board === 'ship') {
    // An admin adds Ship to a project that already stored Factory's boards: the board API
    // stores them before a project's first board of its own, so Work sits beside Ship.
    await boards.load(scope);
    expect(await seeded.boards.get(scope, 'work')).not.toBeNull();
    // The board goes in through the same write path the API and the UI use, and the
    // project's routes send its issues and pull requests there, ahead of Work's defaults.
    await seeded.boards.create(scope, ship, 'admin');
    const issues = await seeded.boards.createIntakeRoute(
      scope,
      {
        name: 'Issues go to Ship',
        when: { operator: 'AND', conditions: [{ field: 'source.kind', operator: 'equals', value: 'issue' }] },
        target: { boardKey: 'ship', ...(issuePhase ? { phaseKey: issuePhase } : {}) },
      },
      'admin',
    );
    const pullRequests = await seeded.boards.createIntakeRoute(
      scope,
      {
        name: 'Pull requests go to Ship review',
        when: { operator: 'AND', conditions: [{ field: 'source.kind', operator: 'equals', value: 'pull_request' }] },
        target: { boardKey: 'ship', phaseKey: 'pr' },
      },
      'admin',
    );
    const routes = await seeded.boards.listIntakeRoutes(scope);
    await seeded.boards.reorderIntakeRoutes(
      scope,
      [
        issues.id,
        pullRequests.id,
        ...routes.map(route => route.id).filter(id => id !== issues.id && id !== pullRequests.id),
      ],
      'admin',
    );
  }

  const configVersion = 'any-board-pr-loop-v1';
  const transitionService = new FactoryTransitionService({ storage: workItems, configVersion, boards });
  const rules = new GithubRules({
    github: {
      rules: resolveGithubRules(),
      slug: 'factory-app',
      getRepositoryCollaboratorPermission: vi.fn().mockResolvedValue('write'),
    } as never,
    sourceControl,
    integrationStorage,
    projects: seeded.projects,
    storage: workItems,
    boards,
    configVersion,
  });
  const dispatcher = new FactoryDecisionDispatcher({
    controller: { getSession: vi.fn(async () => undefined), listActiveThreadRuns: () => [] } as never,
    transitionService,
    storage: workItems,
    boards,
    intakeRoutes: seeded.boards,
    // Runs stay queued: the test plays every agent itself, through the tools agents get.
    ownerId: 'worker-loop',
  });
  let tick = 0;
  const deliver = async (delivery: unknown) => {
    await rules.ingest(delivery as never);
    for (let pass = 0; pass < 3; pass++) {
      await dispatcher.runOnce(new Date(Date.parse('2030-01-01T00:00:00Z') + 1000 * tick++));
    }
  };
  const card = async (id: string) => (await workItems.get({ orgId: 'org-1', id }))!;
  const cards = () => workItems.list(scope);
  /** The runs the card's phases asked for: role and skill, oldest first. */
  const runs = async (id: string) =>
    (await workItems.listDeferredDecisions('org-1', project.id))
      .filter(entry => entry.workItemId === id && entry.decision.type === 'invokeSkill')
      .map(entry => {
        const decision = entry.decision as { role: string; skillName: string };
        return `${decision.role}:${decision.skillName}`;
      });
  /** A person moving the card, the way the board UI does. */
  const move = async (id: string, stage: string) => {
    const current = await card(id);
    return transitionService.transition({
      ...scope,
      workItemId: id,
      board: loop.board,
      stage,
      expectedRevision: current.revision,
      actor: { type: 'human', id: 'user-1' },
      ingress: { type: 'human', identity: `move-${id}-${stage}-${tick++}` },
      cause: 'board_move',
    });
  };
  let sessions = 0;
  /** Binds a fresh agent session in `role` to the card and hands back the tools it would get. */
  const agent = async (id: string, role: string) => {
    sessions += 1;
    const current = await card(id);
    await workItems.prepareRunStart({
      orgId: 'org-1',
      userId: 'user-1',
      factoryProjectId: project.id,
      workItem: {
        id,
        input: { title: current.title, stages: [...current.stages], sessions: {}, metadata: {} },
      },
      role,
      session: { sessionId: `resource-${sessions}`, branch: 'factory/issue-42', threadId: `thread-${sessions}` },
      resourceId: `resource-${sessions}`,
      kickoffKey: `kickoff-${sessions}`,
      kickoffMessage: null,
    });
    const requestContext = new RequestContext();
    requestContext.set('user', { workosId: 'user-1', organizationId: 'org-1' });
    requestContext.set('controller', {
      resourceId: `resource-${sessions}`,
      threadId: `thread-${sessions}`,
      sessionId: `resource-${sessions}`,
      session: { id: `session-${sessions}`, ownerId: 'code', modeId: 'build' },
      getState: () => ({ factoryProjectId: project.id }),
    });
    const tools = await createFactoryTransitionTools({ requestContext, storage: workItems, transitionService, boards });
    const transition = tools.factory_transition_work_item as unknown as {
      execute: (input: unknown, context: unknown) => Promise<unknown>;
    };
    const verdict = tools.factory_record_review_verdict as
      | { execute: (input: unknown, context: unknown) => Promise<unknown> }
      | undefined;
    return {
      tools,
      /** The agent's own move, through the tool it is given. */
      transition: async (stage: string) =>
        transition.execute(
          { stage, expectedRevision: (await card(id)).revision, rationale: 'Maintenance: ready to plan.' },
          { requestContext, agent: { toolCallId: `transition-${sessions}` } },
        ),
      verdict: (input: { verdict: 'approve' | 'request changes'; findings?: string }) =>
        verdict!.execute(
          { reviewedHeadSha: SHA, ...input },
          { requestContext, agent: { toolCallId: `verdict-${sessions}` } },
        ),
    };
  };
  /** What `source_control_create_change_request` leaves behind: the pull request names the card that opened it. */
  const authored = (workItemId: string) =>
    integrationStorage.subscriptions.create({
      orgId: 'org-1',
      targetKey: 'factory-pr-provenance:10:17',
      threadId: 'thread-pr',
      status: 'active',
      data: { kind: 'factory-pr-provenance', factoryProjectId: project.id, workItemId },
    });
  const phases = async () => (await seeded.boards.get(scope, loop.board))!.phases.map(phase => phase.key);
  /** Lets the dispatcher work through what is queued. */
  const settle = async () => {
    for (let pass = 0; pass < 3; pass++) {
      await dispatcher.runOnce(new Date(Date.parse('2030-01-01T00:00:00Z') + 1000 * tick++));
    }
  };
  const decisions = () => workItems.listDeferredDecisions('org-1', project.id);
  return { decisions, deliver, settle, card, cards, runs, move, agent, authored, phases };
}

describe.each(['libsql', ...(postgresUrl ? ['postgres'] : [])])('the pull request loop on %s', backend => {
  describe.each(LOOPS)('on $name', loop => {
    async function cardInBuild(h: Awaited<ReturnType<typeof harness>>) {
      await h.deliver(issueOpened());
      const [issue, ...rest] = await h.cards();
      expect(rest).toEqual([]);
      expect(issue).toMatchObject({ board: loop.board, stages: [loop.rest] });
      for (const stage of loop.toBuild) {
        await expect(h.move(issue!.id, stage)).resolves.toMatchObject({ status: 'accepted' });
      }
      return issue!.id;
    }

    it('builds (self-reviewing where the board has a self-review phase), attaches the pull request it opens, reviews it, re-reviews a push and finishes on merge', async () => {
      const h = await harness(backend, loop);
      const id = await cardInBuild(h);

      if (loop.selfReview) {
        // Self-review: the reviewer's requested changes send the card back to its build phase.
        await h.move(id, loop.selfReview);
        const selfReviewer = await h.agent(id, 'review');
        await expect(
          selfReviewer.verdict({ verdict: 'request changes', findings: 'Missing test.' }),
        ).resolves.toMatchObject({ status: 'recorded', verdict: 'request changes' });
        expect(await h.card(id)).toMatchObject({
          stages: [loop.build],
          metadata: expect.objectContaining({ selfReviewVerdict: 'request changes', selfReviewRounds: 1 }),
        });
      } else {
        // No phase to self-review in: the builder opens the change request itself.
        expect(await h.phases()).not.toContain('review');
        await expect(h.move(id, 'review')).resolves.toMatchObject({ status: 'rejected' });
      }

      // The builder opens the pull request: it joins the card, which goes out for review.
      await h.authored(id);
      await h.deliver(pullRequest('opened', 'delivery-opened'));
      expect(await h.cards()).toHaveLength(1);
      const reviewed = await h.card(id);
      expect(reviewed).toMatchObject({ board: loop.board, stages: [loop.review] });
      expect(reviewed.metadata).toMatchObject({ openPullRequestNumber: 17 });
      expect(await h.runs(id)).toContain('review:factory-review');

      // The reviewer of the pull request records its verdict there; the card stays put.
      const reviewer = await h.agent(id, 'review');
      await expect(reviewer.verdict({ verdict: 'request changes' })).resolves.toMatchObject({ status: 'recorded' });
      expect(await h.card(id)).toMatchObject({
        stages: [loop.review],
        metadata: expect.objectContaining({ reviewVerdict: 'request changes', reviewedHeadSha: SHA }),
      });

      // A push re-enters the review phase, which queues a fresh review pass.
      const before = (await h.runs(id)).filter(run => run === 'review:factory-review').length;
      await h.deliver(pullRequest('synchronize', 'delivery-push'));
      expect(await h.card(id)).toMatchObject({ stages: [loop.review] });
      expect((await h.runs(id)).filter(run => run === 'review:factory-review')).toHaveLength(before + 1);

      // The merge finishes the card in the board's completing phase.
      await h.deliver(pullRequest('closed', 'delivery-merged', true));
      expect(await h.card(id)).toMatchObject({ board: loop.board, stages: [loop.completed] });
    });

    it("sends the card back to rest when its pull request closes unmerged", async () => {
      const h = await harness(backend, loop);
      const id = await cardInBuild(h);
      await h.authored(id);
      await h.deliver(pullRequest('opened', 'delivery-opened'));
      expect(await h.card(id)).toMatchObject({ stages: [loop.review] });

      await h.deliver(pullRequest('closed', 'delivery-closed'));
      expect(await h.card(id)).toMatchObject({ board: loop.board, stages: [loop.rest] });
    });

    it("files a maintainer's pull request in the board's review phase and cancels it when it closes unmerged", async () => {
      const h = await harness(backend, loop);
      await h.deliver(pullRequest('opened', 'delivery-opened'));
      const [card, ...rest] = await h.cards();
      expect(rest).toEqual([]);
      expect(card).toMatchObject({ board: loop.board, stages: [loop.review] });
      expect(await h.runs(card!.id)).toContain('review:factory-review');

      await h.deliver(pullRequest('closed', 'delivery-closed'));
      expect(await h.card(card!.id)).toMatchObject({ board: loop.board, stages: [loop.canceled] });
    });
  });
});

/**
 * A board meant to run without approval gates: its triage agent moves a card straight on to
 * planning, a phase of another context. That move is the agent's say-so, so the planning run it
 * queues starts without a person, whether or not planning starts on its own: neither the move
 * nor its run is held for approval, and nothing about it is Work's.
 */
describe.each(['libsql', ...(postgresUrl ? ['postgres'] : [])])("a triage agent's move to planning on %s", backend => {
  function autonomousShip(planAutoStart: boolean): StoredBoardInput {
    return {
      ...shipBoard,
      phases: [
        ...shipBoard.phases.map(phase =>
          phase.key === 'think'
            ? { ...phase, autoStart: true, nextPhases: ['inbox', 'plan', 'make', 'dropped'] }
            : phase,
        ),
        {
          key: 'plan',
          name: 'Plan',
          kind: 'working' as const,
          runner: { context: 'work', skill: 'factory-plan' },
          autoStart: planAutoStart,
          nextPhases: ['make', 'think', 'inbox', 'dropped'],
        },
      ],
    };
  }

  it.each([true, false])(
    'is accepted, and starts the planning run without a person (planning autoStart: %s)',
    async planAutoStart => {
      // The project's route files the issue in triage itself, as Ship's did; no person moves it.
      const h = await harness(backend, LOOPS[0]!, autonomousShip(planAutoStart), 'think');
      await h.deliver(issueOpened());
      const [issue] = await h.cards();
      expect(issue).toMatchObject({ board: 'ship', stages: ['think'], autonomyArmedAt: null });

      const triage = await h.agent(issue!.id, 'triage');
      await expect(triage.transition('plan')).resolves.toMatchObject({ status: 'accepted' });
      await h.settle();

      expect(await h.card(issue!.id)).toMatchObject({ board: 'ship', stages: ['plan'] });
      const [plan, ...others] = (await h.decisions()).filter(
        entry =>
          entry.workItemId === issue!.id &&
          entry.decision.type === 'invokeSkill' &&
          (entry.decision as { skillName: string }).skillName === 'factory-plan',
      );
      expect(others).toEqual([]);
      // Started (it only waits for the session this test never opens), never parked for a person.
      expect(plan!.status).not.toBe('proposed');
      expect(plan!.approvedBy).toMatch(/^agent:/);
    },
  );
});
