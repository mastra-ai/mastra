import { describe, expect, it, vi } from 'vitest';

import { createBoardRegistry } from '../boards/index.js';
import type { BoardRegistry } from '../boards/index.js';
import { createTestBoard } from '../boards/test-utils.js';
import type { Intake, IntakeIssueDetail } from '../capabilities/intake.js';
import { FactoryDecisionDispatcher } from '../rules/dispatcher.js';
import { FactoryTransitionService } from '../rules/transition-service.js';
import { AUTO_TRIAGED_LABEL } from '../rules/types.js';
import { createFactoryStorageForTests } from '../storage/test-utils.js';
import { defaultGithubRules, resolveGithubRules } from './github/default-rules.js';
import type { GithubRuleOverrides } from './github/default-rules.js';
import { createGithubIssueReconciler } from './github/issue-reconciler.js';
import { reconciledIssueRelabeledEvent } from './github/rules.js';
import type { GithubIssueFetcher, GithubOpenIssueLister, ReconcileIssueState } from './github/rules.js';
import { createIssueReconciler, EXTERNAL_SOURCE_MISSING_KEY } from './issue-reconciler.js';
import { resolveLinearRules } from './linear/default-rules.js';
import { attachLinearIssueReconciler } from './linear/issue-reconciler.js';

function issue(overrides: Partial<IntakeIssueDetail> = {}): IntakeIssueDetail {
  return {
    id: 'linear-uuid',
    identifier: 'ENG-42',
    title: 'Issue',
    url: 'https://linear.app/acme/issue/ENG-42',
    author: 'Linear Ada',
    state: 'In Progress',
    stateType: 'started',
    priority: 'High',
    assignee: 'Linear Grace',
    assignees: ['Linear Grace'],
    source: 'ENG',
    labels: ['triage'],
    commentCount: 0,
    createdAt: '2026-08-01T00:00:00Z',
    updatedAt: '2026-08-02T00:00:00Z',
    description: null,
    comments: [],
    ...overrides,
  };
}

const repository = { id: 10, fullName: 'acme/repo', installationId: 7 };

async function githubSetup(
  input: {
    stages?: string[];
    metadata?: Record<string, unknown>;
    externalId?: string;
    url?: string;
    fetchIssue?: GithubIssueFetcher;
    listOpenIssues?: GithubOpenIssueLister;
    permission?: string;
    rules?: GithubRuleOverrides;
    board?: string;
    boards?: BoardRegistry;
  } = {},
) {
  const seeded = await createFactoryStorageForTests();
  const project = await seeded.projects.create({ orgId: 'org-1', userId: 'user-1', input: { name: 'Factory' } });
  const sourceControl = seeded.sourceControl.forIntegration('github');
  const installation = await sourceControl.installations.upsert({
    orgId: project.orgId,
    connectedByUserId: project.createdBy,
    externalId: String(repository.installationId),
  });
  const storedRepository = await sourceControl.repositories.upsert({
    orgId: project.orgId,
    input: {
      installationId: installation.id,
      externalId: String(repository.id),
      slug: repository.fullName,
      defaultBranch: 'main',
    },
  });
  const connection = await sourceControl.connections.create({
    orgId: project.orgId,
    factoryProjectId: project.id,
    installationId: installation.id,
    createdByUserId: project.createdBy,
  });
  await sourceControl.projectRepositories.link({
    orgId: project.orgId,
    connectionId: connection.id,
    repositoryId: storedRepository.id,
    createdByUserId: project.createdBy,
    sandboxProvider: 'local',
    sandboxWorkdir: '/workspace',
  });
  const workItem = (
    await seeded.workItems.upsert({
      orgId: project.orgId,
      userId: project.createdBy,
      factoryProjectId: project.id,
      input: {
        externalSource: {
          integrationId: 'github',
          type: 'issue',
          externalId: input.externalId ?? 'github-issue:42',
          url: input.url ?? 'https://github.com/acme/repo/issues/42',
        },
        title: 'Issue 42',
        ...(input.board ? { board: input.board } : {}),
        stages: input.stages ?? ['planning'],
        sessions: {},
        metadata: { githubRepositoryId: repository.id, githubIssueNumber: 42, ...(input.metadata ?? {}) },
      },
    })
  ).item;
  const permissionLookup = vi.fn().mockResolvedValue(input.permission);
  const reconciler = createGithubIssueReconciler(
    {
      github: { rules: resolveGithubRules(input.rules), getRepositoryCollaboratorPermission: permissionLookup },
      sourceControl,
      integrationStorage: seeded.integrations.forIntegration('github'),
      projects: seeded.projects,
      storage: seeded.workItems,
      configVersion: 'factory-config-v1',
      boards: input.boards ?? createBoardRegistry(),
    },
    input.fetchIssue ?? vi.fn(),
    input.listOpenIssues,
  );
  return { ...seeded, project, sourceControl, workItem, reconciler, permissionLookup };
}

function githubState(overrides: Partial<ReconcileIssueState> = {}): ReconcileIssueState {
  return {
    title: 'Issue 42',
    url: 'https://github.com/acme/repo/issues/42',
    state: 'open',
    author: 'octocat',
    assignees: ['hubot', 'monalisa'],
    labels: ['bug'],
    ...overrides,
  };
}

describe('issue reconcilers', () => {
  it('does not rewrite a card when provider metadata contains an unchanged object', async () => {
    const seeded = await createFactoryStorageForTests();
    const project = await seeded.projects.create({ orgId: 'org-1', userId: 'user-1', input: { name: 'Factory' } });
    const { item } = await seeded.workItems.upsert({
      orgId: project.orgId,
      userId: project.createdBy,
      factoryProjectId: project.id,
      input: {
        externalSource: {
          integrationId: 'gitlab',
          type: 'issue',
          externalId: 'gitlab-issue:42',
          url: 'https://gitlab.example.com/acme/app/-/issues/42',
        },
        title: 'Issue 42',
        stages: ['intake'],
        sessions: {},
        metadata: {},
      },
    });
    const intake = {
      resolveIntakeDispatch: vi.fn().mockResolvedValue({ issueId: '42', sourceId: 'gitlab-project:1' }),
      getIssue: vi.fn().mockResolvedValue(issue()),
    } as unknown as Intake;
    const reconcile = createIssueReconciler({
      integrationId: 'gitlab',
      intake,
      projects: seeded.projects,
      storage: seeded.workItems,
      issueId: () => '42',
      isTerminal: () => false,
      metadata: () => ({ labelColors: { bug: '#428BCA' }, labels: ['bug'], state: 'opened' }),
    });

    await expect(reconcile()).resolves.toMatchObject({ checked: 1, updated: 1, failed: 0 });
    const afterFirst = await seeded.workItems.get({ orgId: project.orgId, id: item.id });
    await expect(reconcile()).resolves.toMatchObject({ checked: 1, updated: 0, failed: 0 });
    const afterSecond = await seeded.workItems.get({ orgId: project.orgId, id: item.id });
    expect(afterSecond?.revision).toBe(afterFirst?.revision);
  });

  it('backs off missing issues and clears the marker when they return', async () => {
    const seeded = await createFactoryStorageForTests();
    const project = await seeded.projects.create({ orgId: 'org-1', userId: 'user-1', input: { name: 'Factory' } });
    const { item } = await seeded.workItems.upsert({
      orgId: project.orgId,
      userId: project.createdBy,
      factoryProjectId: project.id,
      input: {
        externalSource: {
          integrationId: 'gitlab',
          type: 'issue',
          externalId: 'gitlab-issue:42',
          url: 'https://gitlab.example.com/acme/app/-/issues/42',
        },
        title: 'Issue 42',
        stages: ['intake'],
        sessions: {},
        metadata: {},
      },
    });
    let currentTime = new Date('2026-09-24T12:00:00Z');
    const getIssue = vi.fn().mockResolvedValue(null);
    const intake = {
      resolveIntakeDispatch: vi.fn().mockResolvedValue({ issueId: '42', sourceId: 'gitlab-project:1' }),
      getIssue,
    } as unknown as Intake;
    const reconcile = createIssueReconciler({
      integrationId: 'gitlab',
      intake,
      projects: seeded.projects,
      storage: seeded.workItems,
      issueId: () => '42',
      isTerminal: () => false,
      metadata: () => ({ state: 'opened' }),
      now: () => currentTime,
    });

    await expect(reconcile()).resolves.toMatchObject({ missing: 1, failed: 0 });
    const marked = await seeded.workItems.get({ orgId: project.orgId, id: item.id });
    expect(marked?.metadata?.[EXTERNAL_SOURCE_MISSING_KEY]).toBe(currentTime.toISOString());
    await expect(reconcile()).resolves.toMatchObject({ missing: 1 });
    expect(getIssue).toHaveBeenCalledTimes(1);
    expect((await seeded.workItems.get({ orgId: project.orgId, id: item.id }))?.revision).toBe(marked?.revision);

    currentTime = new Date(currentTime.getTime() + 24 * 60 * 60_000 + 1);
    await reconcile();
    expect(getIssue).toHaveBeenCalledTimes(2);
    const refreshed = await seeded.workItems.get({ orgId: project.orgId, id: item.id });
    expect(refreshed?.metadata?.[EXTERNAL_SOURCE_MISSING_KEY]).toBe(currentTime.toISOString());

    getIssue.mockResolvedValue(issue());
    currentTime = new Date(currentTime.getTime() + 24 * 60 * 60_000 + 1);
    await expect(reconcile()).resolves.toMatchObject({ updated: 1, missing: 0 });
    expect((await seeded.workItems.get({ orgId: project.orgId, id: item.id }))?.metadata).not.toHaveProperty(
      EXTERNAL_SOURCE_MISSING_KEY,
    );

    await seeded.workItems.update({
      orgId: project.orgId,
      id: item.id,
      userId: 'factory-rule-dispatcher',
      patch: { metadata: { [EXTERNAL_SOURCE_MISSING_KEY]: '2099-01-01T00:00:00.000Z' } },
    });
    getIssue.mockResolvedValue(null);
    await expect(reconcile()).resolves.toMatchObject({ missing: 1 });
    expect(getIssue).toHaveBeenCalledTimes(4);
    expect(
      (await seeded.workItems.get({ orgId: project.orgId, id: item.id }))?.metadata?.[EXTERNAL_SOURCE_MISSING_KEY],
    ).toBe(currentTime.toISOString());
  });

  it('retries transient errors and marks unresolved dispatches as missing', async () => {
    const seeded = await createFactoryStorageForTests();
    const project = await seeded.projects.create({ orgId: 'org-1', userId: 'user-1', input: { name: 'Factory' } });
    const { item } = await seeded.workItems.upsert({
      orgId: project.orgId,
      userId: project.createdBy,
      factoryProjectId: project.id,
      input: {
        externalSource: {
          integrationId: 'gitlab',
          type: 'issue',
          externalId: 'gitlab-issue:42',
          url: 'https://gitlab.example.com/acme/app/-/issues/42',
        },
        title: 'Issue 42',
        stages: ['intake'],
        sessions: {},
        metadata: {},
      },
    });
    const getIssue = vi.fn().mockRejectedValue(new Error('upstream 502'));
    const intake = {
      resolveIntakeDispatch: vi.fn().mockResolvedValue({ issueId: '42', sourceId: 'gitlab-project:1' }),
      getIssue,
    } as unknown as Intake;
    const reconcile = createIssueReconciler({
      integrationId: 'gitlab',
      intake,
      projects: seeded.projects,
      storage: seeded.workItems,
      issueId: () => '42',
      isTerminal: () => false,
      metadata: () => ({}),
    });
    await expect(reconcile()).resolves.toMatchObject({ failed: 1, missing: 0 });
    await expect(reconcile()).resolves.toMatchObject({ failed: 1 });
    expect(getIssue).toHaveBeenCalledTimes(2);
    expect((await seeded.workItems.get({ orgId: project.orgId, id: item.id }))?.metadata).not.toHaveProperty(
      EXTERNAL_SOURCE_MISSING_KEY,
    );

    intake.resolveIntakeDispatch = vi.fn().mockResolvedValue(null);
    await expect(reconcile()).resolves.toMatchObject({ missing: 1, failed: 0 });
    expect((await seeded.workItems.get({ orgId: project.orgId, id: item.id }))?.metadata).toHaveProperty(
      EXTERNAL_SOURCE_MISSING_KEY,
    );
  });

  it('reconciles only scoped GitHub issue cards and refreshes metadata', async () => {
    const fetchIssue = vi.fn().mockResolvedValue(githubState());
    const setup = await githubSetup({ metadata: { assignees: ['old'] }, fetchIssue });

    await expect(setup.reconciler([repository])).resolves.toMatchObject({
      repositories: 1,
      checked: 1,
      updated: 1,
      failed: 0,
    });
    expect(fetchIssue).toHaveBeenCalledWith({ installationId: 7, repository: 'acme/repo', number: 42 });
    const [updated] = await setup.workItems.list({ orgId: 'org-1', factoryProjectId: setup.project.id });
    expect(updated?.metadata).toMatchObject({ author: 'octocat', assignees: ['hubot', 'monalisa'], labels: ['bug'] });
  });

  it('backfills author trust on issue cards created before the stamp existed', async () => {
    const fetchIssue = vi.fn().mockResolvedValue(githubState());
    const setup = await githubSetup({ permission: 'write', fetchIssue });

    await setup.reconciler([repository]);

    expect(setup.permissionLookup).toHaveBeenCalledWith(7, 'acme/repo', 'octocat');
    const [updated] = await setup.workItems.list({ orgId: 'org-1', factoryProjectId: setup.project.id });
    expect(updated?.metadata).toMatchObject({ authorTrusted: true });
  });

  it('downgrades a revoked issue author on the next sweep', async () => {
    const fetchIssue = vi.fn().mockResolvedValue(githubState());
    const setup = await githubSetup({ permission: 'write', fetchIssue });

    await setup.reconciler([repository]);
    setup.permissionLookup.mockResolvedValue(undefined);
    await setup.reconciler([repository]);

    const [updated] = await setup.workItems.list({ orgId: 'org-1', factoryProjectId: setup.project.id });
    expect(updated?.metadata).toMatchObject({ authorTrusted: false });
  });

  it('shares one lookup across cards by the same author in a sweep', async () => {
    const fetchIssue = vi.fn().mockResolvedValue(githubState());
    // Both cards' labels already match the fetched issue, so no label drift is
    // replayed: this counts the sweep's own lookups, not a replay's.
    const setup = await githubSetup({ permission: 'write', fetchIssue, metadata: { labels: ['bug'] } });
    await setup.workItems.upsert({
      orgId: setup.project.orgId,
      userId: setup.project.createdBy,
      factoryProjectId: setup.project.id,
      input: {
        externalSource: {
          integrationId: 'github',
          type: 'issue',
          externalId: 'github-issue:43',
          url: 'https://github.com/acme/repo/issues/43',
        },
        title: 'Issue 43',
        stages: ['planning'],
        sessions: {},
        metadata: { githubRepositoryId: repository.id, githubIssueNumber: 43, labels: ['bug'] },
      },
    });

    await setup.reconciler([repository]);

    expect(setup.permissionLookup).toHaveBeenCalledTimes(1);
    const items = await setup.workItems.list({ orgId: 'org-1', factoryProjectId: setup.project.id });
    expect(items).toHaveLength(2);
    for (const item of items) expect(item.metadata).toMatchObject({ authorTrusted: true });
  });

  it('stamps an untrusted issue author as untrusted rather than leaving the card unstamped', async () => {
    const setup = await githubSetup({ fetchIssue: vi.fn().mockResolvedValue(githubState()) });

    await setup.reconciler([repository]);

    const [updated] = await setup.workItems.list({ orgId: 'org-1', factoryProjectId: setup.project.id });
    expect(updated?.metadata).toMatchObject({ authorTrusted: false });
  });

  it('leaves the stamp missing and retries when the permission lookup fails, instead of recording distrust', async () => {
    const setup = await githubSetup({ fetchIssue: vi.fn().mockResolvedValue(githubState()) });
    setup.permissionLookup.mockRejectedValueOnce(new Error('boom'));

    await expect(setup.reconciler([repository])).resolves.toMatchObject({ failed: 1 });
    const [skipped] = await setup.workItems.list({ orgId: 'org-1', factoryProjectId: setup.project.id });
    expect(skipped?.metadata?.authorTrusted).toBeUndefined();

    await setup.reconciler([repository]);
    const [stamped] = await setup.workItems.list({ orgId: 'org-1', factoryProjectId: setup.project.id });
    expect(stamped?.metadata).toMatchObject({ authorTrusted: false });
  });

  it('replays an open issue with no card as a missed opened delivery', async () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    const listOpenIssues = vi.fn().mockResolvedValue([
      { ...githubState(), number: 42, createdAt: future },
      {
        ...githubState({ title: 'Missed', url: 'https://github.com/acme/repo/issues/39' }),
        number: 39,
        createdAt: future,
      },
      { ...githubState({ title: 'Backlog' }), number: 7, createdAt: '2000-01-01T00:00:00Z' },
    ]);
    const setup = await githubSetup({
      fetchIssue: vi.fn().mockResolvedValue(githubState({ labels: [] })),
      listOpenIssues,
      metadata: { labels: [] },
    });

    await expect(setup.reconciler([repository])).resolves.toMatchObject({ created: 1, failed: 0 });
    const decisions = await setup.workItems.listDeferredDecisions('org-1', setup.project.id);
    expect(decisions.map(entry => entry.decision)).toMatchObject([{ type: 'upsertLinkedWorkItem' }]);
    expect(JSON.stringify(decisions)).toContain('github-issue:39');

    // A repeat sweep dedupes at the ingress by the stable delivery id.
    await setup.reconciler([repository]);
    expect(await setup.workItems.listDeferredDecisions('org-1', setup.project.id)).toHaveLength(1);
  });

  it('replays a stable GitHub close through rules ingress without a direct metadata write', async () => {
    const setup = await githubSetup({
      fetchIssue: vi.fn().mockResolvedValue(githubState({ state: 'closed', stateReason: 'not_planned' })),
    });
    const update = vi.spyOn(setup.workItems, 'update');

    await expect(setup.reconciler([repository])).resolves.toMatchObject({ checked: 1, closed: 1, updated: 0 });
    await expect(setup.reconciler([repository])).resolves.toMatchObject({ checked: 1, closed: 1, updated: 0 });
    expect(update).not.toHaveBeenCalled();
    const decisions = await setup.workItems.listDeferredDecisions('org-1', setup.project.id);
    expect(decisions).toHaveLength(1);
    expect(decisions[0]?.decision).toMatchObject({ type: 'transition', stage: 'canceled' });
  });

  it('adopts a missing label snapshot without replaying policy', async () => {
    const issueOpened = vi.fn(defaultGithubRules.issueOpened);
    const setup = await githubSetup({
      stages: ['planning'],
      metadata: {},
      fetchIssue: vi.fn().mockResolvedValue(githubState({ labels: ['bug'] })),
      rules: { issueOpened },
    });

    await expect(setup.reconciler([repository])).resolves.toMatchObject({ checked: 1, relabeled: 0, failed: 0 });
    expect(issueOpened).not.toHaveBeenCalled();
    expect(await setup.workItems.listDeferredDecisions('org-1', setup.project.id)).toHaveLength(0);
    expect(await setup.workItems.get({ orgId: 'org-1', id: setup.workItem.id })).toMatchObject({
      stages: ['planning'],
      metadata: { labels: ['bug'] },
    });
  });

  it('replays a label change through rules ingress with the issue live labels', async () => {
    const issueOpened = vi.fn((context: Parameters<typeof defaultGithubRules.issueOpened>[0]) => {
      const decision = defaultGithubRules.issueOpened(context);
      return decision ? { ...decision, stage: 'planning' as const, skipRules: true } : undefined;
    });
    const setup = await githubSetup({
      stages: ['intake'],
      metadata: { labels: ['bug'] },
      // `status: auto-triaged` is what the triage skill stamps when it finishes,
      // so the deployment's rule files such an issue straight on Planning.
      fetchIssue: vi.fn().mockResolvedValue(githubState({ labels: ['bug', AUTO_TRIAGED_LABEL] })),
      rules: { issueOpened },
    });

    await expect(setup.reconciler([repository])).resolves.toMatchObject({ checked: 1, relabeled: 1, failed: 0 });

    // The rule runs as an arrival would, seeing the labels the issue carries now.
    expect(issueOpened).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'issueOpened',
        issue: expect.objectContaining({ number: 42, labels: ['bug', AUTO_TRIAGED_LABEL] }),
      }),
    );
    // The placement is committed for the dispatcher, which files the card at
    // Planning without running any of the board's phase rules.
    const decisions = await setup.workItems.listDeferredDecisions('org-1', setup.project.id);
    expect(decisions.map(entry => entry.decision)).toMatchObject([
      { type: 'upsertLinkedWorkItem', board: 'work', stage: 'planning', skipRules: true },
    ]);
    // The sync still refreshes the card's own label facts.
    const [updated] = await setup.workItems.list({ orgId: 'org-1', factoryProjectId: setup.project.id });
    expect(updated?.metadata).toMatchObject({ labels: ['bug', AUTO_TRIAGED_LABEL] });
    expect(updated?.stages).toEqual(['intake']);

    // Dispatch the committed decision and the existing card is relocated onto
    // Planning — the same landing an arrival gets, with no phase rule run for it.
    const boards = createBoardRegistry();
    const dispatcher = new FactoryDecisionDispatcher({
      controller: {} as never,
      storage: setup.workItems,
      boards,
      transitionService: new FactoryTransitionService({
        storage: setup.workItems,
        boards,
        configVersion: 'factory-config-v1',
      }),
      isAutoRunEnabled: async () => true,
      ownerId: 'reconcile-worker',
    });
    await dispatcher.runOnce(new Date('2030-01-01T00:00:01Z'));
    expect(await setup.workItems.get({ orgId: 'org-1', id: setup.workItem.id })).toMatchObject({
      board: 'work',
      stages: ['planning'],
    });
  });

  it('moves a card back out of Planning when the label that filed it there is dropped', async () => {
    // The deployment's own policy, mirrored: `status: auto-triaged` files a card
    // on Planning; without it the labels put the card on Triage. A card that has
    // already left Intake is re-placed, not re-entered.
    const issueOpened = vi.fn((context: Parameters<typeof defaultGithubRules.issueOpened>[0]) => {
      const decision = defaultGithubRules.issueOpened(context);
      if (!decision || !context.issue) return decision;
      const labels = context.issue.labels ?? [];
      const moved = context.item !== undefined && !context.item.stages.includes(decision.stage);
      if (labels.includes(AUTO_TRIAGED_LABEL)) return { ...decision, stage: 'planning' as const, skipRules: true };
      return moved
        ? { ...decision, stage: 'triage' as const, skipRules: true }
        : { ...decision, stage: 'triage' as const };
    });
    const setup = await githubSetup({
      stages: ['planning'],
      metadata: { labels: ['bug', AUTO_TRIAGED_LABEL] },
      fetchIssue: vi.fn().mockResolvedValue(githubState({ labels: ['bug'] })),
      rules: { issueOpened },
    });

    await expect(setup.reconciler([repository])).resolves.toMatchObject({ checked: 1, relabeled: 1, failed: 0 });

    const decisions = await setup.workItems.listDeferredDecisions('org-1', setup.project.id);
    expect(decisions.map(entry => entry.decision)).toMatchObject([
      { type: 'upsertLinkedWorkItem', board: 'work', stage: 'triage', skipRules: true },
    ]);

    const boards = createBoardRegistry();
    const dispatcher = new FactoryDecisionDispatcher({
      controller: {} as never,
      storage: setup.workItems,
      boards,
      transitionService: new FactoryTransitionService({
        storage: setup.workItems,
        boards,
        configVersion: 'factory-config-v1',
      }),
      isAutoRunEnabled: async () => true,
      ownerId: 'reconcile-worker',
    });
    await dispatcher.runOnce(new Date('2030-01-01T00:00:01Z'));

    // The card follows the labels it no longer carries: Planning → Triage.
    expect(await setup.workItems.get({ orgId: 'org-1', id: setup.workItem.id })).toMatchObject({
      board: 'work',
      stages: ['triage'],
    });
    // Placement, not a governed entry: Triage's entry rule never fires.
    const afterDispatch = await setup.workItems.listDeferredDecisions('org-1', setup.project.id);
    expect(afterDispatch.map(entry => entry.decision.type)).toEqual(['upsertLinkedWorkItem']);
  });

  it('replays a label change without skipRules when the rule does not ask for it', async () => {
    const setup = await githubSetup({
      stages: ['intake'],
      metadata: { labels: ['bug'] },
      fetchIssue: vi.fn().mockResolvedValue(githubState({ labels: ['bug', 'curated'] })),
      rules: {
        issueOpened: context => {
          const decision = defaultGithubRules.issueOpened(context);
          return decision ? { ...decision, stage: 'triage' } : undefined;
        },
      },
    });

    await expect(setup.reconciler([repository])).resolves.toMatchObject({ checked: 1, relabeled: 1, failed: 0 });

    // Left to the normal path: the dispatcher transitions the card and the
    // destination phase's entry rule decides what, if anything, runs.
    const decisions = await setup.workItems.listDeferredDecisions('org-1', setup.project.id);
    expect(decisions.map(entry => entry.decision)).toMatchObject([
      { type: 'upsertLinkedWorkItem', board: 'work', stage: 'triage' },
    ]);
    expect(decisions[0]?.decision).not.toHaveProperty('skipRules');
  });

  it('replays nothing while an open issue labels are unchanged', async () => {
    const setup = await githubSetup({
      stages: ['intake'],
      metadata: { labels: ['bug'] },
      fetchIssue: vi.fn().mockResolvedValue(githubState({ labels: ['bug'] })),
      rules: {
        issueOpened: context => {
          const decision = defaultGithubRules.issueOpened(context);
          return decision ? { ...decision, stage: 'planning', skipRules: true } : undefined;
        },
      },
    });

    await expect(setup.reconciler([repository])).resolves.toMatchObject({ checked: 1, relabeled: 0 });

    const [updated] = await setup.workItems.list({ orgId: 'org-1', factoryProjectId: setup.project.id });
    expect(updated?.stages).toEqual(['intake']);
  });

  it('replays nothing for a card whose issue labels drift only into order', async () => {
    const setup = await githubSetup({
      stages: ['intake'],
      metadata: { labels: ['bug', 'curated'] },
      fetchIssue: vi.fn().mockResolvedValue(githubState({ labels: ['curated', 'bug', 'bug'] })),
      rules: {
        issueOpened: context => {
          const decision = defaultGithubRules.issueOpened(context);
          return decision ? { ...decision, stage: 'planning', skipRules: true } : undefined;
        },
      },
    });

    await expect(setup.reconciler([repository])).resolves.toMatchObject({ checked: 1, relabeled: 0 });
    expect(await setup.workItems.listDeferredDecisions('org-1', setup.project.id)).toEqual([]);
  });

  it('gives retries of one observed issue version the same relabel identity', () => {
    const deliveryId = (labels: string[], updatedAt?: string) =>
      reconciledIssueRelabeledEvent(repository, 42, githubState({ labels, ...(updatedAt ? { updatedAt } : {}) }))
        .deliveryId;

    // Same labels, same issue version: the ingress dedupes rather than re-placing.
    expect(deliveryId(['bug'], '2026-08-01T00:00:00Z')).toBe(deliveryId(['bug'], '2026-08-01T00:00:00Z'));
    // Label order is not a version: only the set matters.
    expect(deliveryId(['bug', 'curated'], '2026-08-01T00:00:00Z')).toBe(
      deliveryId(['curated', 'bug'], '2026-08-01T00:00:00Z'),
    );
    // A → B → A is three observed versions, so the final A is not a replay of the first.
    expect(
      new Set([
        deliveryId(['bug', AUTO_TRIAGED_LABEL], '2026-08-01T00:00:00Z'),
        deliveryId(['bug'], '2026-08-02T00:00:00Z'),
        deliveryId(['bug', AUTO_TRIAGED_LABEL], '2026-08-03T00:00:00Z'),
      ]).size,
    ).toBe(3);
  });

  it('relocates A to B and back to A because each observed version is its own delivery', async () => {
    // Labels decide the phase: `status: auto-triaged` files on Planning, without
    // it the card belongs on Triage, wherever it currently rests.
    const issueOpened = vi.fn((context: Parameters<typeof defaultGithubRules.issueOpened>[0]) => {
      const decision = defaultGithubRules.issueOpened(context);
      if (!decision || !context.issue) return decision;
      const moved = context.item !== undefined && !context.item.stages.includes(decision.stage);
      if ((context.issue.labels ?? []).includes(AUTO_TRIAGED_LABEL))
        return { ...decision, stage: 'planning' as const, skipRules: true };
      return moved
        ? { ...decision, stage: 'triage' as const, skipRules: true }
        : { ...decision, stage: 'triage' as const };
    });
    const fetched = vi.fn();
    const setup = await githubSetup({
      stages: ['triage'],
      metadata: { labels: ['bug'] },
      fetchIssue: fetched,
      rules: { issueOpened },
    });
    const boards = createBoardRegistry();
    const dispatcher = new FactoryDecisionDispatcher({
      controller: {} as never,
      storage: setup.workItems,
      boards,
      transitionService: new FactoryTransitionService({
        storage: setup.workItems,
        boards,
        configVersion: 'factory-config-v1',
      }),
      isAutoRunEnabled: async () => true,
      ownerId: 'reconcile-worker',
    });
    const sweep = async (labels: string[], version: string, tick: string) => {
      fetched.mockResolvedValue(githubState({ labels, updatedAt: version }));
      await setup.reconciler([repository]);
      await dispatcher.runOnce(new Date(tick));
      return (await setup.workItems.get({ orgId: 'org-1', id: setup.workItem.id }))?.stages;
    };

    // A → B → A: the third sweep sees the same label set as the first, but a
    // later issue version, so it is a new placement rather than a replay.
    expect(await sweep(['bug', AUTO_TRIAGED_LABEL], '2026-08-01T00:00:00Z', '2030-01-01T00:00:01Z')).toEqual([
      'planning',
    ]);
    expect(await sweep(['bug'], '2026-08-02T00:00:00Z', '2030-01-01T00:00:02Z')).toEqual(['triage']);
    expect(await sweep(['bug', AUTO_TRIAGED_LABEL], '2026-08-03T00:00:00Z', '2030-01-01T00:00:03Z')).toEqual([
      'planning',
    ]);
  });

  it('uses a replacement handler for reconciled closures without running the default', async () => {
    const issueClosed = vi.fn(() => undefined);
    const setup = await githubSetup({
      rules: { issueClosed },
      fetchIssue: vi.fn().mockResolvedValue(githubState({ state: 'closed' })),
    });
    await expect(setup.reconciler([repository])).resolves.toMatchObject({ checked: 1, closed: 1, failed: 0 });
    expect(issueClosed).toHaveBeenCalledOnce();
    expect(issueClosed).toHaveBeenCalledWith(expect.objectContaining({ event: 'issueClosed' }));
    expect(await setup.workItems.listDeferredDecisions('org-1', setup.project.id)).toEqual([]);
  });

  it('disables reconciled closures without breaking bookkeeping or another instance', async () => {
    const fetchIssue = vi.fn().mockResolvedValue(githubState({ state: 'closed' }));
    const disabled = await githubSetup({ rules: { issueClosed: null }, fetchIssue });
    const defaults = await githubSetup({ fetchIssue });
    await expect(disabled.reconciler([repository])).resolves.toMatchObject({ checked: 1, closed: 1, failed: 0 });
    await expect(disabled.reconciler([repository])).resolves.toMatchObject({ checked: 1, closed: 1, failed: 0 });
    expect(await disabled.workItems.listDeferredDecisions('org-1', disabled.project.id)).toEqual([]);
    await expect(defaults.reconciler([repository])).resolves.toMatchObject({ checked: 1, closed: 1, failed: 0 });
    expect(await defaults.workItems.listDeferredDecisions('org-1', defaults.project.id)).toHaveLength(1);
  });

  it('skips terminal GitHub cards and preserves undefined provider metadata', async () => {
    const terminalFetch = vi.fn();
    const terminal = await githubSetup({ stages: ['done'], fetchIssue: terminalFetch });
    await expect(terminal.reconciler([repository])).resolves.toMatchObject({ checked: 0 });
    expect(terminalFetch).not.toHaveBeenCalled();

    const setup = await githubSetup({
      metadata: { author: 'stored author', labels: ['stored'] },
      fetchIssue: vi.fn().mockResolvedValue(githubState({ author: undefined, labels: undefined, assignees: ['new'] })),
    });
    await expect(setup.reconciler([repository])).resolves.toMatchObject({ updated: 1, failed: 0 });
    const [updated] = await setup.workItems.list({ orgId: 'org-1', factoryProjectId: setup.project.id });
    expect(updated?.metadata).toMatchObject({ author: 'stored author', labels: ['stored'], assignees: ['new'] });
  });

  it('reads terminal from the installed board, so a custom final phase is skipped and an undeclared one is not', async () => {
    const boards = createBoardRegistry({ boards: [createTestBoard()] });
    const shippedFetch = vi.fn();
    const shipped = await githubSetup({ board: 'release', stages: ['shipped'], fetchIssue: shippedFetch, boards });
    await expect(shipped.reconciler([repository])).resolves.toMatchObject({ checked: 0 });
    expect(shippedFetch).not.toHaveBeenCalled();

    // `done` means nothing on the release board: no guess, the card is still swept.
    const doneFetch = vi.fn().mockResolvedValue(githubState({}));
    const done = await githubSetup({ board: 'release', stages: ['done'], fetchIssue: doneFetch, boards });
    await expect(done.reconciler([repository])).resolves.toMatchObject({ checked: 1 });
    expect(doneFetch).toHaveBeenCalledTimes(1);
  });

  it.each(['default', 'replacement', 'disabled'] as const)(
    'replays canceled Linear issues with %s instance rules',
    async mode => {
      const seeded = await createFactoryStorageForTests();
      const project = await seeded.projects.create({ orgId: 'org-1', userId: 'user-1', input: { name: 'Factory' } });
      await seeded.workItems.upsert({
        orgId: project.orgId,
        userId: project.createdBy,
        factoryProjectId: project.id,
        input: {
          externalSource: {
            integrationId: 'linear',
            type: 'issue',
            externalId: 'linear:ENG-42',
            url: 'https://linear.app/acme/issue/ENG-42',
          },
          title: 'ENG-42: Issue',
          stages: ['planning'],
          sessions: {},
          metadata: { linearIssueId: 'linear-uuid' },
        },
      });
      const intake = {
        resolveIntakeDispatch: vi
          .fn()
          .mockResolvedValue({ connection: { type: 'oauth', accessToken: 'token' }, issueId: 'linear-uuid' }),
        getIssue: vi.fn().mockResolvedValue(issue({ state: 'Canceled', stateType: 'canceled' })),
      } as unknown as Intake;
      const replacement = vi.fn(() => ({
        type: 'notify' as const,
        idempotencyKey: 'reconciled-linear',
        title: 'Closed issue',
      }));
      const reconcile = attachLinearIssueReconciler(
        {
          intake,
          rules: resolveLinearRules(
            mode === 'default' ? undefined : { issueClosed: mode === 'disabled' ? null : replacement },
          ),
        },
        {
          storage: { projects: seeded.projects },
          runtime: { configVersion: 'factory-config-v1', workItems: seeded.workItems, boards: createBoardRegistry() },
        } as never,
      );

      await expect(reconcile?.()).resolves.toMatchObject({ checked: 1, closed: 1, updated: 0 });
      const decisions = await seeded.workItems.listDeferredDecisions('org-1', project.id);
      expect(decisions).toHaveLength(mode === 'disabled' ? 0 : 1);
      if (mode === 'default') expect(decisions[0]?.decision).toMatchObject({ type: 'transition', stage: 'canceled' });
      if (mode === 'replacement') {
        expect(replacement).toHaveBeenCalledOnce();
        expect(decisions[0]?.decision).toMatchObject({ type: 'notify', title: 'Closed issue' });
      }
    },
  );
});
