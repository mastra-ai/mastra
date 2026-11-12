import { describe, expect, it, vi } from 'vitest';

import { createBoardRegistry } from '../boards/index.js';
import { ProjectBoardCache } from '../boards/project-boards.js';
import type { ReconcileIssueState } from '../integrations/github/rules.js';
import { createGithubWorkItemSync } from '../integrations/github/work-item-sync.js';
import type { StoredIntakeRouteInput } from '../storage/domains/boards/base.js';
import { createFactoryStorageForTests } from '../storage/test-utils.js';
import { FactoryTransitionService } from './transition-service.js';

const AREA_DOCS = {
  operator: 'AND',
  conditions: [{ field: 'item.labels', operator: 'contains', value: 'area: docs' }],
} as const;

/** A custom board whose Triage run labels the issue, then hands the card to Planning. */
const shipyard = {
  key: 'shipyard',
  name: 'Shipyard',
  phases: [
    { key: 'inbox', name: 'Inbox', kind: 'resting' as const, nextPhases: ['triage'] },
    {
      key: 'triage',
      name: 'Triage',
      kind: 'working' as const,
      runner: { context: 'triage' },
      nextPhases: ['planning', 'shipped'],
    },
    { key: 'planning', name: 'Planning', kind: 'resting' as const, nextPhases: ['shipped'] },
    // A shipped card can be reopened into Planning.
    { key: 'shipped', name: 'Shipped', kind: 'terminal' as const, nextPhases: ['planning'] },
  ],
};

const docs = {
  key: 'docs',
  name: 'Docs',
  phases: [
    { key: 'inbox', name: 'Inbox', kind: 'resting' as const, nextPhases: ['writing'] },
    { key: 'writing', name: 'Writing', kind: 'resting' as const, nextPhases: ['published'] },
    { key: 'published', name: 'Published', kind: 'terminal' as const },
  ],
};

/**
 * Real storage, the project's stored boards and routes, and GitHub faked at its API: the issue's
 * labels live only in `github.labels` until the card is synced, as when no webhook arrived.
 */
async function setup() {
  const seeded = await createFactoryStorageForTests();
  const project = await seeded.projects.create({ orgId: 'org-1', userId: 'user-1', input: { name: 'Routes' } });
  const scope = { orgId: 'org-1', factoryProjectId: project.id };
  for (const seededRoute of (await seeded.boards.listIntakeRoutes(scope)).toReversed()) {
    await seeded.boards.deleteIntakeRoute(scope, seededRoute.id, { expectedRevision: seededRoute.revision });
  }
  await seeded.boards.create(scope, shipyard, 'admin');
  await seeded.boards.create(scope, docs, 'admin');

  const sourceControl = seeded.sourceControl.forIntegration('github');
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

  const github = {
    issue: {
      title: 'Docs are wrong',
      url: 'https://github.com/acme/repo/issues/42',
      state: 'open',
      labels: ['status: needs triage'],
      author: 'octocat',
      assignees: [],
    } as ReconcileIssueState,
    fail: false,
  };
  const fetchIssue = vi.fn(async () => {
    if (github.fail) throw new Error('GitHub is down');
    return github.issue;
  });
  const sync = createGithubWorkItemSync({
    github: { getRepositoryCollaboratorPermission: async () => 'write' },
    sourceControl,
    storage: seeded.workItems,
    fetchIssue,
    fetchPullRequest: async () => undefined,
  });
  const boards = new ProjectBoardCache({ codeRegistry: createBoardRegistry(), storage: seeded.boards, recheckMs: 0 });
  const service = new FactoryTransitionService({
    configVersion: 'phase-exit-v1',
    boards,
    storage: seeded.workItems,
    audit: seeded.audit,
    routes: seeded.boards,
    syncWorkItem: sync,
  });

  const card = (
    await seeded.workItems.upsert({
      orgId: 'org-1',
      userId: 'user-1',
      factoryProjectId: project.id,
      input: {
        board: 'shipyard',
        externalSource: {
          integrationId: 'github',
          type: 'issue',
          externalId: 'github-issue:42',
          url: 'https://github.com/acme/repo/issues/42',
        },
        title: 'Docs are wrong',
        stages: ['triage'],
        sessions: {},
        metadata: { githubRepositoryId: 10, githubIssueNumber: 42, labels: ['status: needs triage'] },
      },
    })
  ).item;

  const route = (input: Partial<StoredIntakeRouteInput>) =>
    seeded.boards.createIntakeRoute(
      scope,
      {
        name: 'Docs work',
        on: ['phase.exited'],
        from: { boardKey: 'shipyard', phaseKey: 'triage' },
        when: AREA_DOCS,
        target: { boardKey: 'docs', phaseKey: 'writing' },
        ...input,
      },
      'admin',
    );

  let moves = 0;
  /** Moves the card as the Triage agent does with factory_transition_work_item. */
  const move = async (cardId: string, board: string, stage: string) => {
    const current = (await seeded.workItems.get({ orgId: 'org-1', id: cardId }))!;
    moves += 1;
    return service.transition({
      orgId: 'org-1',
      factoryProjectId: project.id,
      workItemId: cardId,
      board,
      stage,
      expectedRevision: current.revision,
      actor: { type: 'agent', bindingId: 'triage-binding', role: 'triage' },
      ingress: { type: 'agent', identity: `move-${moves}` },
      cause: 'agent_tool',
    });
  };
  const get = async (cardId: string) => (await seeded.workItems.get({ orgId: 'org-1', id: cardId }))!;
  return { seeded, scope, github, fetchIssue, card, route, move, get };
}

describe('phase-exit routes', () => {
  it('routes a card leaving Triage on the labels Triage set at GitHub, without a webhook', async () => {
    const { github, card, route, move, get, seeded, scope } = await setup();
    const docsRoute = await route({});
    // Triage labelled the issue at GitHub; no `labeled` delivery reached Factory.
    github.issue = { ...github.issue, labels: ['status: auto-triaged', 'area: docs'], title: 'Docs: fix the intro' };

    const result = await move(card.id, 'shipyard', 'planning');

    expect(result).toMatchObject({
      status: 'accepted',
      stage: 'writing',
      board: 'docs',
      route: { id: docsRoute.id, name: 'Docs work' },
    });
    const moved = await get(card.id);
    expect(moved.board).toBe('docs');
    expect(moved.stages).toEqual(['writing']);
    // The card now holds what GitHub holds.
    expect(moved.workItem.labels).toEqual(['status: auto-triaged', 'area: docs']);
    expect(moved.title).toBe('Docs: fix the intro');
    const entered = moved.stageHistory.at(-1);
    expect(entered).toMatchObject({
      stage: 'writing',
      board: 'docs',
      routedBy: { id: docsRoute.id, name: 'Docs work' },
    });
    expect(moved.stageHistory.find(entry => entry.stage === 'triage')?.exitedAt).toBeDefined();
    const audit = await seeded.audit.list({
      orgId: 'org-1',
      factoryProjectId: scope.factoryProjectId,
      actions: ['factory.work_item.stage_moved'],
    });
    const moveEvent = audit.events.find(row => row.action === 'factory.work_item.stage_moved');
    // The Triage agent moved the card; the route only chose where to.
    expect(moveEvent).toMatchObject({ actorType: 'agent', actorId: 'agent:triage-binding' });
    expect(moveEvent?.metadata).toMatchObject({
      route: { id: docsRoute.id, name: 'Docs work' },
      fromBoard: 'shipyard',
      toBoard: 'docs',
    });
  });

  it("sends the card to the mover's phase when no route matches", async () => {
    const { github, card, route, move, get } = await setup();
    await route({});
    github.issue = { ...github.issue, labels: ['status: auto-triaged', 'area: api'] };

    const result = await move(card.id, 'shipyard', 'planning');

    expect(result).toMatchObject({ status: 'accepted', stage: 'planning' });
    expect(result).not.toHaveProperty('route');
    const moved = await get(card.id);
    expect(moved.board).toBe('shipyard');
    expect(moved.stages).toEqual(['planning']);
    expect(moved.workItem.labels).toEqual(['status: auto-triaged', 'area: api']);
  });

  it("does not run the destination phase's routes again: one hop", async () => {
    const { github, card, route, move, get } = await setup();
    await route({});
    // A route listening on the phase the first route lands in would chain the card onward.
    await route({
      name: 'Bounce back',
      when: null,
      from: { boardKey: 'docs', phaseKey: 'writing' },
      target: { boardKey: 'shipyard', phaseKey: 'planning' },
    });
    github.issue = { ...github.issue, labels: ['area: docs'] };

    await move(card.id, 'shipyard', 'planning');

    const moved = await get(card.id);
    expect(moved.board).toBe('docs');
    expect(moved.stages).toEqual(['writing']);
  });

  it('skips a route whose target can no longer take the card and keeps looking', async () => {
    const { github, card, route, move, get } = await setup();
    // Saved before the Docs board lost its Writing phase: the route names a phase no longer there.
    await route({ name: 'Gone', when: null, target: { boardKey: 'docs', phaseKey: 'drafting' } });
    await route({ name: 'Fallback docs', when: null, target: { boardKey: 'docs', phaseKey: 'inbox' } });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    github.issue = { ...github.issue, labels: ['area: docs'] };

    const result = await move(card.id, 'shipyard', 'planning');

    expect(result).toMatchObject({
      status: 'accepted',
      board: 'docs',
      stage: 'inbox',
      route: { name: 'Fallback docs' },
    });
    expect((await get(card.id)).stages).toEqual(['inbox']);
    expect(warn.mock.calls.some(([message]) => String(message).includes('"Gone"'))).toBe(true);
    warn.mockRestore();
  });

  it('routes on stored facts and still moves when GitHub cannot be read', async () => {
    const { github, card, route, move, get } = await setup();
    await route({
      when: {
        operator: 'AND',
        conditions: [{ field: 'item.labels', operator: 'contains', value: 'status: needs triage' }],
      },
    });
    github.fail = true;
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await move(card.id, 'shipyard', 'planning');

    expect(result).toMatchObject({ status: 'accepted', board: 'docs', stage: 'writing' });
    expect((await get(card.id)).workItem.labels).toEqual(['status: needs triage']);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('leaves moves that close the card, and cards on phases no route listens on, alone', async () => {
    const { github, card, route, move, get, fetchIssue } = await setup();
    await route({ when: null });
    github.issue = { ...github.issue, labels: ['area: docs'] };

    const closed = await move(card.id, 'shipyard', 'shipped');

    expect(closed).toMatchObject({ status: 'accepted', stage: 'shipped' });
    expect((await get(card.id)).board).toBe('shipyard');
    expect(fetchIssue).not.toHaveBeenCalled();
  });

  it("records a route's move to another board's phase of the same name", async () => {
    const { seeded, scope, route, move, get } = await setup();
    const inboxCard = (
      await seeded.workItems.upsert({
        orgId: 'org-1',
        userId: 'user-1',
        factoryProjectId: scope.factoryProjectId,
        input: {
          board: 'shipyard',
          externalSource: { integrationId: 'native', type: 'task', externalId: 'native:inbox-card' },
          title: 'Write the intro',
          stages: ['inbox'],
          sessions: {},
          metadata: {},
        },
      })
    ).item;
    await route({
      when: null,
      from: { boardKey: 'shipyard', phaseKey: 'inbox' },
      target: { boardKey: 'docs', phaseKey: 'inbox' },
    });

    const result = await move(inboxCard.id, 'shipyard', 'triage');

    expect(result).toMatchObject({ status: 'accepted', stage: 'inbox', board: 'docs' });
    expect((await get(inboxCard.id)).board).toBe('docs');
    const audit = await seeded.audit.list({
      orgId: 'org-1',
      factoryProjectId: scope.factoryProjectId,
      actions: ['factory.work_item.stage_moved'],
    });
    expect(audit.events.find(row => row.targets.some(target => target.id === inboxCard.id))?.metadata).toMatchObject({
      from: 'inbox',
      to: 'inbox',
      fromBoard: 'shipyard',
      toBoard: 'docs',
    });
  });

  it("skips a route into a working phase while the left phase's exit tool still holds the card", async () => {
    const { seeded, scope, route, move, get } = await setup();
    await seeded.boards.create(
      scope,
      {
        key: 'design',
        name: 'Design',
        phases: [
          { key: 'inbox', name: 'Inbox', kind: 'resting' as const, nextPhases: ['draft'] },
          {
            key: 'draft',
            name: 'Draft',
            kind: 'working' as const,
            runner: { context: 'work' },
            exitTool: { id: 'submit_plan', autoApprove: false },
            nextPhases: ['parked', 'build'],
          },
          { key: 'parked', name: 'Parked', kind: 'resting' as const, nextPhases: ['build'] },
          { key: 'build', name: 'Build', kind: 'working' as const, runner: { context: 'work' }, nextPhases: ['done'] },
          { key: 'done', name: 'Done', kind: 'terminal' as const },
        ],
      },
      'admin',
    );
    const draft = (
      await seeded.workItems.upsert({
        orgId: 'org-1',
        userId: 'user-1',
        factoryProjectId: scope.factoryProjectId,
        input: {
          board: 'design',
          externalSource: { integrationId: 'native', type: 'task', externalId: 'native:draft-card' },
          title: 'Design the intro',
          stages: ['draft'],
          sessions: {},
          metadata: {},
        },
      })
    ).item;
    await route({
      name: 'Straight to build',
      when: null,
      from: { boardKey: 'design', phaseKey: 'draft' },
      target: { boardKey: 'design', phaseKey: 'build' },
    });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // No plan was approved: parking the card is allowed, starting the build is not.
    const result = await move(draft.id, 'design', 'parked');

    expect(result).toMatchObject({ status: 'accepted', stage: 'parked' });
    expect(result).not.toHaveProperty('route');
    expect((await get(draft.id)).stages).toEqual(['parked']);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('"Straight to build"'));
    warn.mockRestore();
  });

  it('does not route a card leaving a phase that is terminal by now', async () => {
    const { github, card, route, move, get, fetchIssue } = await setup();
    // Saved before a board edit made the phase terminal: saving refuses a terminal `from` today.
    await route({ when: null, from: { boardKey: 'shipyard', phaseKey: 'shipped' } });
    github.issue = { ...github.issue, labels: ['area: docs'] };
    await move(card.id, 'shipyard', 'shipped');

    const reopened = await move(card.id, 'shipyard', 'planning');

    expect(reopened).toMatchObject({ status: 'accepted', stage: 'planning' });
    expect(reopened).not.toHaveProperty('route');
    expect((await get(card.id)).board).toBe('shipyard');
    expect(fetchIssue).not.toHaveBeenCalled();
  });

  it('refuses to store a phase-exit route that names another event or misses `from`', async () => {
    const { route } = await setup();
    await expect(route({ on: ['phase.exited', 'work_item.closed'] })).rejects.toThrow(/handles no other event/);
    await expect(route({ from: undefined })).rejects.toThrow(/needs `from`/);
    await expect(route({ on: ['work_item.created'] })).rejects.toThrow(/Only a route that handles phase.exited/);
  });
});
