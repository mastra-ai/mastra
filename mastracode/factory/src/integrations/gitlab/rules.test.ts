import { describe, expect, it, vi } from 'vitest';
import { createBoardRegistry } from '../../boards/index.js';
import { createFactoryStorageForTests } from '../../storage/test-utils.js';
import { resolveGitLabRules } from './default-rules.js';
import { encodeSourceId } from './integration.js';
import { GitLabRules } from './rules.js';
import type { GitLabRulesIntegration } from './rules.js';

const PROJECT_ID = '101';
const PROJECT_PATH = 'acme/app';
const SOURCE_ID = encodeSourceId({ host: 'gitlab.example.com', projectId: PROJECT_ID });

function issueOpened(deliveryId = 'delivery-1', author = 'maintainer') {
  return {
    event: 'Issue Hook',
    deliveryId,
    instanceHost: 'gitlab.example.com',
    payload: {
      user_username: 'maintainer',
      user: { username: 'maintainer' },
      project: {
        id: 101,
        path_with_namespace: PROJECT_PATH,
        web_url: 'https://gitlab.example.com/acme/app',
      },
      object_attributes: {
        id: 420,
        iid: 42,
        action: 'open',
        state: 'opened',
        title: 'Issue 42',
        url: 'https://gitlab.example.com/acme/app/-/issues/42',
        created_at: '2030-01-01T00:00:00Z',
        author: { username: author },
      },
      labels: [{ title: 'bug', color: '#428BCA' }],
    },
  } as const;
}

function mergeRequestOpened(deliveryId = 'delivery-mr-1', author = 'maintainer') {
  return {
    event: 'Merge Request Hook',
    deliveryId,
    instanceHost: 'gitlab.example.com',
    payload: {
      user_username: 'maintainer',
      user: { username: 'maintainer' },
      project: {
        id: 101,
        path_with_namespace: PROJECT_PATH,
        web_url: 'https://gitlab.example.com/acme/app',
      },
      object_attributes: {
        id: 170,
        iid: 17,
        action: 'open',
        state: 'opened',
        title: 'MR 17',
        url: 'https://gitlab.example.com/acme/app/-/merge_requests/17',
        created_at: '2030-01-01T00:00:00Z',
        source_branch: 'feature-17',
        target_branch: 'main',
        author: { username: author },
      },
    },
  } as const;
}

async function setup(
  options: { selected?: boolean; accessLevel?: number; duplicateInstallation?: boolean; installationHost?: string } = {},
) {
  const seeded = await createFactoryStorageForTests();
  const sourceControl = seeded.sourceControl.forIntegration('gitlab');
  const project = await seeded.projects.create({
    orgId: 'org-1',
    userId: 'user-1',
    input: { name: 'Project 1' },
  });

  async function link(externalId: string) {
    const installation = await sourceControl.installations.upsert({
      orgId: 'org-1',
      connectedByUserId: 'user-1',
      externalId,
      providerMetadata: { host: options.installationHost ?? 'gitlab.example.com' },
    });
    const repository = await sourceControl.repositories.upsert({
      orgId: 'org-1',
      input: {
        installationId: installation.id,
        externalId: PROJECT_ID,
        slug: PROJECT_PATH,
        defaultBranch: 'main',
      },
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
  }

  await link('direct');
  if (options.duplicateInstallation) await link('platform-connection');
  await seeded.intake.saveConfig({
    orgId: 'org-1',
    config: {
      gitlab: {
        enabled: true,
        sourceIds: options.selected === false ? null : [SOURCE_ID],
      },
    },
  });
  await seeded.intake.setBinding({
    orgId: 'org-1',
    integrationId: 'gitlab',
    sourceId: SOURCE_ID,
    factoryProjectId: project.id,
    board: 'work',
    userId: 'user-1',
  });

  const gitlab: GitLabRulesIntegration = {
    rules: resolveGitLabRules(),
    getProjectMemberAccessLevel: vi.fn().mockResolvedValue(options.accessLevel ?? 40),
  };
  const service = new GitLabRules({
    gitlab,
    sourceControl,
    projects: seeded.projects,
    storage: seeded.workItems,
    intake: seeded.intake,
    configVersion: 'gitlab-test-v1',
    boards: createBoardRegistry(),
  });
  return { seeded, project, gitlab, service };
}

describe('GitLabRules', () => {
  it('commits a selected linked issue once and replays the same delivery', async () => {
    const { seeded, project, service } = await setup();
    await expect(service.ingest(issueOpened())).resolves.toEqual({ status: 'committed' });
    await expect(service.ingest(issueOpened())).resolves.toEqual({ status: 'replayed' });

    const decisions = await seeded.workItems.listDeferredDecisions('org-1', project.id);
    expect(decisions).toHaveLength(1);
    expect(decisions[0]).toMatchObject({
      actor: { type: 'gitlab', username: 'maintainer', trusted: true, factoryAuthored: false },
      decision: {
        type: 'upsertLinkedWorkItem',
        source: 'gitlab-issue',
        board: 'work',
        metadata: {
          gitlabProjectId: 101,
          gitlabIssueIid: 42,
          identifier: 'acme/app#42',
          authorTrusted: true,
          autoStartCandidate: true,
          labelColors: { bug: '#428BCA' },
        },
      },
    });
  });

  it('ignores a webhook whose instance header disagrees with its project URL', async () => {
    const { seeded, project, gitlab, service } = await setup();
    await expect(service.ingest({ ...issueOpened(), instanceHost: 'other-gitlab.example.com' })).resolves.toEqual({
      status: 'ignored',
    });
    expect(gitlab.getProjectMemberAccessLevel).not.toHaveBeenCalled();
    expect(await seeded.workItems.listDeferredDecisions('org-1', project.id)).toEqual([]);
  });

  it('ignores a same-numbered project linked from a different GitLab host', async () => {
    const { seeded, project, gitlab, service } = await setup({ installationHost: 'other-gitlab.example.com' });
    await expect(service.ingest(issueOpened())).resolves.toEqual({ status: 'ignored' });
    expect(gitlab.getProjectMemberAccessLevel).not.toHaveBeenCalled();
    expect(await seeded.workItems.listDeferredDecisions('org-1', project.id)).toEqual([]);
  });

  it('ignores an issue when its canonical source is not selected', async () => {
    const { seeded, project, service } = await setup({ selected: false });
    await expect(service.ingest(issueOpened())).resolves.toEqual({ status: 'ignored' });
    expect(await seeded.workItems.listDeferredDecisions('org-1', project.id)).toEqual([]);
  });

  it('deduplicates direct and Platform installations linked to the same Factory project', async () => {
    const { seeded, project, gitlab, service } = await setup({ duplicateInstallation: true });
    await expect(service.ingest(issueOpened())).resolves.toEqual({ status: 'committed' });
    expect(await seeded.workItems.listDeferredDecisions('org-1', project.id)).toHaveLength(1);
    expect(gitlab.getProjectMemberAccessLevel).toHaveBeenCalledTimes(1);
  });

  it('fails actor trust closed when GitLab membership cannot be resolved', async () => {
    const { seeded, project, gitlab, service } = await setup();
    vi.mocked(gitlab.getProjectMemberAccessLevel).mockRejectedValue(new Error('GitLab unavailable'));
    await expect(service.ingest(issueOpened())).resolves.toEqual({ status: 'committed' });
    expect(await seeded.workItems.listDeferredDecisions('org-1', project.id)).toMatchObject([
      {
        actor: { type: 'gitlab', trusted: false },
        decision: { metadata: { authorTrusted: false, autoStartCandidate: false } },
      },
    ]);
  });

  it('does not trust an issue author merely because the webhook sender is trusted', async () => {
    const { seeded, project, gitlab, service } = await setup();
    vi.mocked(gitlab.getProjectMemberAccessLevel).mockImplementation(async (_connectionId, _projectId, username) =>
      username === 'maintainer' ? 40 : 10,
    );

    await expect(service.ingest(issueOpened('issue-untrusted-author', 'external-author'))).resolves.toEqual({
      status: 'committed',
    });
    expect(await seeded.workItems.listDeferredDecisions('org-1', project.id)).toMatchObject([
      {
        actor: { username: 'maintainer', trusted: true },
        decision: {
          metadata: {
            author: 'external-author',
            authorTrusted: false,
            autoStartCandidate: false,
          },
        },
      },
    ]);
  });

  it('materializes GitLab merge requests as Review cards with provider identity', async () => {
    const { seeded, project, service } = await setup();
    await expect(service.ingest(mergeRequestOpened())).resolves.toEqual({ status: 'committed' });
    expect(await seeded.workItems.listDeferredDecisions('org-1', project.id)).toMatchObject([
      {
        decision: {
          type: 'upsertLinkedWorkItem',
          source: 'gitlab-pr',
          board: 'review',
          metadata: {
            gitlabProjectId: 101,
            gitlabMergeRequestIid: 17,
            authorTrusted: true,
            headBranch: 'feature-17',
            baseBranch: 'main',
          },
        },
      },
    ]);
  });
  it('does not trust a merge-request author merely because the webhook sender is trusted', async () => {
    const { seeded, project, gitlab, service } = await setup();
    vi.mocked(gitlab.getProjectMemberAccessLevel).mockImplementation(async (_connectionId, _projectId, username) =>
      username === 'maintainer' ? 40 : 10,
    );

    await expect(service.ingest(mergeRequestOpened('mr-untrusted-author', 'external-author'))).resolves.toEqual({
      status: 'committed',
    });
    expect(await seeded.workItems.listDeferredDecisions('org-1', project.id)).toMatchObject([
      {
        actor: { username: 'maintainer', trusted: true },
        decision: {
          metadata: {
            author: 'external-author',
            authorTrusted: false,
            autoStartCandidate: false,
          },
        },
      },
    ]);
  });

});
