import { describe, expect, it, vi } from 'vitest';

import type { Intake, IntakeIssueDetail } from '../capabilities/intake.js';
import { builtInFactoryRules } from '../rules/defaults.js';
import { createFactoryStorageForTests } from '../storage/test-utils.js';
import { createGithubIssueReconciler } from './github/issue-reconciler.js';
import type { GithubIssueFetcher, ReconcileIssueState } from './github/rules.js';
import type { LinearIntegration } from './linear/integration.js';
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

async function githubSetup(input: {
  stages?: string[];
  metadata?: Record<string, unknown>;
  externalId?: string;
  url?: string;
  fetchIssue?: GithubIssueFetcher;
  permission?: string;
} = {}) {
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
    input: { installationId: installation.id, externalId: String(repository.id), slug: repository.fullName, defaultBranch: 'main' },
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
        stages: input.stages ?? ['planning'],
        sessions: {},
        metadata: { githubRepositoryId: repository.id, githubIssueNumber: 42, ...(input.metadata ?? {}) },
      },
    })
  ).item;
  const permissionLookup = vi.fn().mockResolvedValue(input.permission);
  const reconciler = createGithubIssueReconciler(
    {
      github: { getRepositoryCollaboratorPermission: permissionLookup },
      sourceControl,
      integrationStorage: seeded.integrations.forIntegration('github'),
      projects: seeded.projects,
      storage: seeded.workItems,
      rules: builtInFactoryRules(),
    },
    input.fetchIssue ?? vi.fn(),
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
  it('reconciles only scoped GitHub issue cards and refreshes metadata', async () => {
    const fetchIssue = vi.fn().mockResolvedValue(githubState());
    const setup = await githubSetup({ metadata: { assignees: ['old'] }, fetchIssue });

    await expect(setup.reconciler([repository])).resolves.toMatchObject({ repositories: 1, checked: 1, updated: 1, failed: 0 });
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
    const setup = await githubSetup({ permission: 'write', fetchIssue });
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
        metadata: { githubRepositoryId: repository.id, githubIssueNumber: 43 },
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

  it('replays canceled Linear issues through rules ingress', async () => {
    const seeded = await createFactoryStorageForTests();
    const project = await seeded.projects.create({ orgId: 'org-1', userId: 'user-1', input: { name: 'Factory' } });
    await seeded.workItems.upsert({
      orgId: project.orgId,
      userId: project.createdBy,
      factoryProjectId: project.id,
      input: {
        externalSource: { integrationId: 'linear', type: 'issue', externalId: 'linear:ENG-42', url: 'https://linear.app/acme/issue/ENG-42' },
        title: 'ENG-42: Issue',
        stages: ['planning'],
        sessions: {},
        metadata: { linearIssueId: 'linear-uuid' },
      },
    });
    const intake = {
      resolveIntakeDispatch: vi.fn().mockResolvedValue({ connection: { type: 'oauth', accessToken: 'token' }, issueId: 'linear-uuid' }),
      getIssue: vi.fn().mockResolvedValue(issue({ state: 'Canceled', stateType: 'canceled' })),
    } as unknown as Intake;
    const reconcile = attachLinearIssueReconciler(
      { intake } as Pick<LinearIntegration, 'intake'>,
      {
        storage: { projects: seeded.projects },
        rules: { config: builtInFactoryRules(), workItems: seeded.workItems },
      } as never,
    );

    await expect(reconcile?.()).resolves.toMatchObject({ checked: 1, closed: 1, updated: 0 });
    const decisions = await seeded.workItems.listDeferredDecisions('org-1', project.id);
    expect(decisions).toHaveLength(1);
    expect(decisions[0]?.decision).toMatchObject({ type: 'transition', stage: 'canceled' });
  });
});
