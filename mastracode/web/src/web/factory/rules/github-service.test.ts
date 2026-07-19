import { describe, expect, it, vi } from 'vitest';
import type { GithubIntegration } from '../../github/integration.js';
import { seedFactoryStorageForTests } from '../../storage/test-utils.js';
import { builtInFactoryRules, defaultFactoryRules } from './defaults.js';
import { FactoryGithubEventService } from './github-service.js';

async function setup(permission: string | undefined) {
  const seeded = await seedFactoryStorageForTests();
  const workItems = seeded.workItems;
  const sourceControl = seeded.sourceControl.forIntegration('github');
  const integrationStorage = seeded.integrations.forIntegration<
    Record<string, unknown>,
    Record<string, unknown>,
    { kind: 'factory-pr-provenance'; workItemId: string }
  >('github');
  const project = await seeded.projects.create({
    orgId: 'org-1',
    userId: 'user-1',
    input: { name: 'Project 1' },
  });
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
    getRepositoryCollaboratorPermission: vi.fn().mockResolvedValue(permission),
  } as unknown as GithubIntegration;
  return { sourceControl, integrationStorage, workItems, projects: seeded.projects, project, github };
}

function issueOpened(deliveryId = 'delivery-1') {
  return {
    event: 'issues',
    deliveryId,
    payload: {
      action: 'opened',
      installation: { id: 7 },
      repository: { id: 10, full_name: 'acme/repo' },
      sender: { login: 'maintainer' },
      issue: { number: 42, title: 'Issue 42', html_url: 'https://github.com/acme/repo/issues/42' },
    },
  };
}

function pullRequest(event: 'opened' | 'closed', deliveryId: string, merged = false) {
  return {
    event: 'pull_request',
    deliveryId,
    payload: {
      action: event,
      installation: { id: 7 },
      repository: { id: 10, full_name: 'acme/repo' },
      sender: { login: 'contributor' },
      pull_request: {
        number: 17,
        title: 'PR 17',
        html_url: 'https://github.com/acme/repo/pull/17',
        state: merged ? 'closed' : 'open',
        merged,
        head: { ref: 'feature' },
        base: { ref: 'main' },
      },
    },
  };
}

describe('FactoryGithubEventService', () => {
  it('commits one trusted issue intake decision and replays immutable delivery ingress', async () => {
    const { github, sourceControl, integrationStorage, workItems, project } = await setup('write');
    const service = new FactoryGithubEventService({
      github,
      sourceControl,
      integrationStorage,
      storage: workItems,
      rules: builtInFactoryRules(),
    });

    await expect(service.ingest(issueOpened())).resolves.toEqual({ status: 'committed' });
    await expect(service.ingest(issueOpened())).resolves.toEqual({ status: 'replayed' });
    const decisions = await workItems.listDeferredDecisions('org-1', project.id);
    expect(decisions).toHaveLength(1);
    expect(decisions[0]?.actor).toMatchObject({ type: 'github', login: 'maintainer', trusted: true });
    expect(decisions[0]?.decision).toMatchObject({ type: 'upsertLinkedWorkItem', source: 'github-issue' });
  });

  it('prefers canonical board identities over legacy GitHub rows during ingress', async () => {
    const { github, sourceControl, integrationStorage, workItems, project } = await setup('write');
    const issue = await workItems.upsert({
      orgId: 'org-1',
      userId: 'user-1',
      factoryProjectId: project.id,
      input: {
        externalSource: {
          integrationId: 'github',
          type: 'issue',
          externalId: 'github-issue:42',
          url: 'https://github.com/acme/repo/issues/42',
        },
        title: 'Issue 42',
        stages: ['intake'],
        sessions: {},
        metadata: { number: 42 },
      },
    });
    const review = await workItems.upsert({
      orgId: 'org-1',
      userId: 'user-1',
      factoryProjectId: project.id,
      input: {
        externalSource: {
          integrationId: 'github',
          type: 'pull-request',
          externalId: 'github-pr:17',
          url: 'https://github.com/acme/repo/pull/17',
        },
        title: 'PR 17',
        stages: ['intake'],
        sessions: {},
        metadata: { number: 17 },
      },
    });
    await workItems.upsert({
      orgId: 'org-1',
      userId: 'user-1',
      factoryProjectId: project.id,
      input: {
        externalSource: {
          integrationId: 'github',
          type: 'issue',
          externalId: 'github:10:issue:42',
          url: 'https://github.com/acme/repo/issues/42',
        },
        title: 'Legacy issue 42',
        stages: ['intake'],
        sessions: {},
        metadata: {},
      },
    });
    await workItems.upsert({
      orgId: 'org-1',
      userId: 'user-1',
      factoryProjectId: project.id,
      input: {
        externalSource: {
          integrationId: 'github',
          type: 'pull-request',
          externalId: 'github:10:pull-request:17',
          url: 'https://github.com/acme/repo/pull/17',
        },
        title: 'Legacy PR 17',
        stages: ['intake'],
        sessions: {},
        metadata: {},
      },
    });
    const service = new FactoryGithubEventService({
      github,
      sourceControl,
      integrationStorage,
      storage: workItems,
      rules: builtInFactoryRules(),
    });

    await service.ingest(issueOpened('delivery-canonical-issue'));
    await service.ingest(pullRequest('opened', 'delivery-canonical-pr'));

    const decisions = await workItems.listDeferredDecisions('org-1', project.id);
    expect(decisions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          workItemId: issue.item.id,
          decision: expect.objectContaining({ source: 'github-issue' }),
        }),
        expect.objectContaining({
          workItemId: review.item.id,
          decision: expect.objectContaining({ source: 'github-pr' }),
        }),
      ]),
    );
  });

  it.each(['maintain', 'triage', 'read', undefined])('fails closed for GitHub permission %s', async permission => {
    const { github, sourceControl, integrationStorage, workItems, project } = await setup(permission);
    const seen = vi.fn(() => undefined);
    const rules = defaultFactoryRules({ version: 'test-1', overrides: { github: { issueOpened: { onEvent: seen } } } });
    const service = new FactoryGithubEventService({
      github,
      sourceControl,
      integrationStorage,
      storage: workItems,
      rules,
    });

    await service.ingest(issueOpened(`delivery-${permission ?? 'missing'}`));
    expect(seen).toHaveBeenCalledWith(expect.objectContaining({ actor: expect.objectContaining({ trusted: false }) }));
    expect(await workItems.listDeferredDecisions('org-1', project.id)).toEqual([]);
  });

  it('uses verified Factory provenance to link an opened Review card and remind Work on merge', async () => {
    const { github, sourceControl, integrationStorage, workItems, project } = await setup('read');
    const work = await workItems.upsert({
      orgId: 'org-1',
      userId: 'user-1',
      factoryProjectId: project.id,
      input: {
        externalSource: {
          integrationId: 'github',
          type: 'issue',
          externalId: 'github:10:issue:42',
          url: 'https://github.com/acme/repo/issues/42',
        },
        title: 'Issue 42',
        stages: ['execute'],
        sessions: {},
        metadata: {},
      },
    });
    await integrationStorage.subscriptions.create({
      orgId: 'org-1',
      targetKey: 'factory-pr-provenance:10:17',
      threadId: 'thread-1',
      status: 'active',
      data: { kind: 'factory-pr-provenance', workItemId: work.item.id },
    });
    const service = new FactoryGithubEventService({
      github,
      sourceControl,
      integrationStorage,
      storage: workItems,
      rules: builtInFactoryRules(),
    });

    await service.ingest(pullRequest('opened', 'delivery-open'));
    await service.ingest(pullRequest('closed', 'delivery-merge', true));
    const decisions = await workItems.listDeferredDecisions('org-1', project.id);
    expect(decisions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          workItemId: work.item.id,
          decision: expect.objectContaining({ type: 'upsertLinkedWorkItem' }),
        }),
        expect.objectContaining({
          workItemId: work.item.id,
          decision: expect.objectContaining({ type: 'sendMessage', role: 'work' }),
        }),
      ]),
    );
    expect(decisions.map(entry => entry.decision)).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ type: 'transition' })]),
    );
  });

  it('evaluates the same delivery independently for every tenant project mapped to the repository', async () => {
    const { github, sourceControl, integrationStorage, workItems, projects, project } = await setup('write');
    const second = await projects.create({
      orgId: 'org-2',
      userId: 'user-2',
      input: { name: 'Project 2' },
    });
    const installation = await sourceControl.installations.upsert({
      orgId: 'org-2',
      connectedByUserId: 'user-2',
      externalId: '7',
    });
    const repository = await sourceControl.repositories.upsert({
      orgId: 'org-2',
      input: { installationId: installation.id, externalId: '10', slug: 'acme/repo', defaultBranch: 'main' },
    });
    const connection = await sourceControl.connections.create({
      orgId: 'org-2',
      factoryProjectId: second.id,
      installationId: installation.id,
      createdByUserId: 'user-2',
    });
    await sourceControl.projectRepositories.link({
      orgId: 'org-2',
      connectionId: connection.id,
      repositoryId: repository.id,
      createdByUserId: 'user-2',
      sandboxProvider: 'local',
      sandboxWorkdir: '/workspace',
    });
    const service = new FactoryGithubEventService({
      github,
      sourceControl,
      integrationStorage,
      storage: workItems,
      rules: builtInFactoryRules(),
    });

    await service.ingest(issueOpened('multi-tenant'));
    expect(await workItems.listDeferredDecisions('org-1', project.id)).toHaveLength(1);
    expect(await workItems.listDeferredDecisions('org-2', second.id)).toHaveLength(1);
  });
});
