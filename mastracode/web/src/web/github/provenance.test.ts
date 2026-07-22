import { describe, expect, it, vi } from 'vitest';
import { seedFactoryStorageForTests } from '../storage/test-utils.js';
import type { GithubIntegration } from './integration.js';
import { recordFactoryPullRequestProvenance, type FactoryPullRequestProvenanceData } from './provenance.js';

async function setup() {
  const seeded = await seedFactoryStorageForTests();
  const sourceControl = seeded.sourceControl.forIntegration('github');
  const integrationStorage = seeded.integrations.forIntegration<
    Record<string, unknown>,
    Record<string, unknown>,
    FactoryPullRequestProvenanceData
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
  const pullsGet = vi.fn().mockResolvedValue({
    data: { number: 17, html_url: 'https://github.com/acme/repo/pull/17', base: { repo: { id: 10 } } },
  });
  const github = {
    getInstallationOctokit: vi.fn(() => ({ pulls: { get: pullsGet } })),
  } as unknown as GithubIntegration;
  const input = {
    binding: {
      id: 'binding-1',
      orgId: 'org-1',
      factoryProjectId: project.id,
      workItemId: 'item-1',
      threadId: 'thread-1',
      resourceId: 'resource-1',
      projectPath: '/workspace',
      branch: 'feature',
      role: 'work',
      status: 'active' as const,
      kickoffKey: 'kickoff-1',
      createdAt: new Date(),
      revokedAt: null,
    },
    item: {
      id: 'item-1',
      orgId: 'org-1',
      userId: 'user-1',
      createdBy: 'user-1',
      factoryProjectId: project.id,
      externalSource: {
        integrationId: 'github',
        type: 'issue',
        externalId: 'github:10:issue:42',
        url: 'https://github.com/acme/repo/issues/42',
      },
      parentWorkItemId: null,
      title: 'Issue 42',
      stages: ['execute'],
      sessions: {},
      metadata: {},
      revision: 2,
      createdAt: new Date(),
      updatedAt: new Date(),
      stageHistory: [],
    },
    assistantMessageId: 'message-1',
    toolCallId: 'call-1',
    toolName: 'execute_command',
    toolInput: { command: 'gh pr create --title "PR 17" --body "body"' },
    toolResult: { stdout: 'https://github.com/acme/repo/pull/17\n' },
    status: 'success' as const,
  };
  return { sourceControl, integrationStorage, project, github, pullsGet, input };
}

describe('recordFactoryPullRequestProvenance', () => {
  it('records only a verified gh pr create result for the exact bound Factory work item', async () => {
    const { sourceControl, integrationStorage, github, pullsGet, input } = await setup();
    await recordFactoryPullRequestProvenance(github, sourceControl, integrationStorage, input);

    expect(pullsGet).toHaveBeenCalledWith({ owner: 'acme', repo: 'repo', pull_number: 17 });
    expect((await integrationStorage.subscriptions.listByTarget('factory-pr-provenance:10:17'))[0]).toMatchObject({
      threadId: 'thread-1',
      data: {
        bindingId: 'binding-1',
        workItemId: 'item-1',
        assistantMessageId: 'message-1',
        toolCallId: 'call-1',
      },
    });
  });

  it('ignores unrelated command results and API mismatches', async () => {
    const { sourceControl, integrationStorage, github, input, pullsGet } = await setup();
    await recordFactoryPullRequestProvenance(github, sourceControl, integrationStorage, {
      ...input,
      toolInput: { command: 'gh pr view 17' },
    });
    expect(pullsGet).not.toHaveBeenCalled();

    pullsGet.mockResolvedValueOnce({
      data: { number: 17, html_url: 'https://github.com/other/repo/pull/17', base: { repo: { id: 99 } } },
    });
    await recordFactoryPullRequestProvenance(github, sourceControl, integrationStorage, input);
    expect(await integrationStorage.subscriptions.listByTarget('factory-pr-provenance:10:17')).toEqual([]);
  });

  it('fails closed when pull request verification is unavailable', async () => {
    const { sourceControl, integrationStorage, github, input, pullsGet } = await setup();
    pullsGet.mockRejectedValueOnce(new Error('GitHub unavailable'));

    await expect(
      recordFactoryPullRequestProvenance(github, sourceControl, integrationStorage, input),
    ).resolves.toBeUndefined();
    expect(await integrationStorage.subscriptions.listByTarget('factory-pr-provenance:10:17')).toEqual([]);
  });
});
