import { describe, expect, it, vi } from 'vitest';

import type { Intake, IntakeIssueDetail } from '../capabilities/intake.js';
import { builtInFactoryRules } from '../rules/defaults.js';
import { createFactoryStorageForTests } from '../storage/test-utils.js';
import { createGithubIssueReconciler } from './github/issue-reconciler.js';
import type { ReconcileIssueState } from './github/rules.js';
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
  const reconciler = createGithubIssueReconciler(
    {
      github: { getRepositoryCollaboratorPermission: vi.fn() },
      sourceControl,
      integrationStorage: seeded.integrations.forIntegration('github'),
      projects: seeded.projects,
      storage: seeded.workItems,
      rules: builtInFactoryRules(),
    },
    vi.fn(),
  );
  return { ...seeded, project, sourceControl, workItem, reconciler };
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
    const setup = await githubSetup({ metadata: { assignees: ['old'] } });
    const fetchIssue = vi.fn().mockResolvedValue(githubState());
    const reconcile = createGithubIssueReconciler(
      {
        github: { getRepositoryCollaboratorPermission: vi.fn() },
        sourceControl: setup.sourceControl,
        integrationStorage: setup.integrations.forIntegration('github'),
        projects: setup.projects,
        storage: setup.workItems,
        rules: builtInFactoryRules(),
      },
      fetchIssue,
    );

    await expect(reconcile([repository])).resolves.toMatchObject({ repositories: 1, checked: 1, updated: 1, failed: 0 });
    expect(fetchIssue).toHaveBeenCalledWith({ installationId: 7, repository: 'acme/repo', number: 42 });
    const [updated] = await setup.workItems.list({ orgId: 'org-1', factoryProjectId: setup.project.id });
    expect(updated?.metadata).toMatchObject({ author: 'octocat', assignees: ['hubot', 'monalisa'], labels: ['bug'] });
  });

  it('replays a stable GitHub close through rules ingress without a direct metadata write', async () => {
    const setup = await githubSetup();
    const update = vi.spyOn(setup.workItems, 'update');
    const reconcile = createGithubIssueReconciler(
      {
        github: { getRepositoryCollaboratorPermission: vi.fn() },
        sourceControl: setup.sourceControl,
        integrationStorage: setup.integrations.forIntegration('github'),
        projects: setup.projects,
        storage: setup.workItems,
        rules: builtInFactoryRules(),
      },
      vi.fn().mockResolvedValue(githubState({ state: 'closed', stateReason: 'not_planned' })),
    );

    await expect(reconcile([repository])).resolves.toMatchObject({ checked: 1, closed: 1, updated: 0 });
    await expect(reconcile([repository])).resolves.toMatchObject({ checked: 1, closed: 1, updated: 0 });
    expect(update).not.toHaveBeenCalled();
    const decisions = await setup.workItems.listDeferredDecisions('org-1', setup.project.id);
    expect(decisions).toHaveLength(1);
    expect(decisions[0]?.decision).toMatchObject({ type: 'transition', stage: 'canceled' });
  });

  it('skips terminal and unrelated GitHub cards, preserves undefined provider metadata, and isolates failures', async () => {
    const terminal = await githubSetup({ stages: ['done'] });
    const terminalFetch = vi.fn();
    const terminalReconcile = createGithubIssueReconciler(
      {
        github: { getRepositoryCollaboratorPermission: vi.fn() },
        sourceControl: terminal.sourceControl,
        integrationStorage: terminal.integrations.forIntegration('github'),
        projects: terminal.projects,
        storage: terminal.workItems,
        rules: builtInFactoryRules(),
      },
      terminalFetch,
    );
    await expect(terminalReconcile([repository])).resolves.toMatchObject({ checked: 0 });
    expect(terminalFetch).not.toHaveBeenCalled();

    const setup = await githubSetup({ metadata: { author: 'stored author', labels: ['stored'] } });
    const reconcile = createGithubIssueReconciler(
      {
        github: { getRepositoryCollaboratorPermission: vi.fn() },
        sourceControl: setup.sourceControl,
        integrationStorage: setup.integrations.forIntegration('github'),
        projects: setup.projects,
        storage: setup.workItems,
        rules: builtInFactoryRules(),
      },
      vi.fn().mockResolvedValue(githubState({ author: undefined, labels: undefined, assignees: ['new'] })),
    );
    await expect(reconcile([repository])).resolves.toMatchObject({ updated: 1, failed: 0 });
    const [updated] = await setup.workItems.list({ orgId: 'org-1', factoryProjectId: setup.project.id });
    expect(updated?.metadata).toMatchObject({ author: 'stored author', labels: ['stored'], assignees: ['new'] });
  });

  it('replays completed and canceled Linear issues through rules ingress', async () => {
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
