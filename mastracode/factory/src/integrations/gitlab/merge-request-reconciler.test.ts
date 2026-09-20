import { describe, expect, it, vi } from 'vitest';

import { createBoardRegistry } from '../../boards/index.js';
import type { PullRequest, VersionControl } from '../../capabilities/version-control.js';
import { createFactoryStorageForTests } from '../../storage/test-utils.js';
import type { IntegrationContext } from '../base.js';
import { resolveGitLabRules } from './default-rules.js';
import { encodeSourceId } from './integration.js';
import { attachGitLabMergeRequestReconciler } from './merge-request-reconciler.js';

const PROJECT_ID = '101';
const PROJECT_PATH = 'acme/app';
const HOST = 'gitlab.example.com';
const SOURCE_ID = encodeSourceId({ host: HOST, projectId: PROJECT_ID });
const MERGE_REQUEST_SOURCE = `gitlab-pr:${Buffer.from(
  JSON.stringify({ version: 1, host: HOST, projectId: 101, mergeRequestIid: 17 }),
  'utf8',
).toString('base64url')}`;

describe('GitLab merge-request reconciler', () => {
  it.each([
    { initialStage: 'review', initialState: 'open', merged: true, expectedStage: 'done', missingIdentity: false },
    { initialStage: 'review', initialState: 'closed', merged: false, expectedStage: 'canceled', missingIdentity: false },
    { initialStage: 'review', initialState: 'open', merged: false, expectedStage: 'canceled', missingIdentity: true },
    { initialStage: 'done', initialState: 'open', merged: false, expectedStage: 'canceled', missingIdentity: true },
  ])('replays a missed terminal outcome from $initialStage through governed rules', async ({ initialStage, initialState, merged, expectedStage, missingIdentity }) => {
    const seeded = await createFactoryStorageForTests();
    const sourceControl = seeded.sourceControl.forIntegration('gitlab');
    const project = await seeded.projects.create({ orgId: 'org-1', userId: 'user-1', input: { name: 'Factory' } });
    const installation = await sourceControl.installations.upsert({
      orgId: project.orgId,
      connectedByUserId: project.createdBy,
      externalId: 'direct',
      providerMetadata: { host: HOST },
    });
    const repository = await sourceControl.repositories.upsert({
      orgId: project.orgId,
      input: {
        installationId: installation.id,
        externalId: PROJECT_ID,
        slug: PROJECT_PATH,
        defaultBranch: 'main',
      },
    });
    const connection = await sourceControl.connections.create({
      orgId: project.orgId,
      factoryProjectId: project.id,
      installationId: installation.id,
      createdByUserId: project.createdBy,
    });
    if (!missingIdentity) {
      await sourceControl.projectRepositories.link({
        orgId: project.orgId,
        connectionId: connection.id,
        repositoryId: repository.id,
        createdByUserId: project.createdBy,
        sandboxProvider: 'local',
        sandboxWorkdir: '/workspace',
      });
    }
    const wrongInstallation = await sourceControl.installations.upsert({
      orgId: project.orgId,
      connectedByUserId: project.createdBy,
      externalId: 'aaa-platform',
      providerMetadata: { host: HOST },
    });
    const wrongRepository = await sourceControl.repositories.upsert({
      orgId: project.orgId,
      input: {
        installationId: wrongInstallation.id,
        externalId: PROJECT_ID,
        slug: missingIdentity ? PROJECT_PATH : 'other/app',
        defaultBranch: 'main',
      },
    });
    const wrongConnection = await sourceControl.connections.create({
      orgId: project.orgId,
      factoryProjectId: project.id,
      installationId: wrongInstallation.id,
      createdByUserId: project.createdBy,
    });
    await sourceControl.projectRepositories.link({
      orgId: project.orgId,
      connectionId: wrongConnection.id,
      repositoryId: wrongRepository.id,
      createdByUserId: project.createdBy,
      sandboxProvider: 'local',
      sandboxWorkdir: '/workspace/other',
    });
    await seeded.intake.saveConfig({
      orgId: project.orgId,
      config: { gitlab: { enabled: true, sourceIds: [SOURCE_ID] } },
    });
    await seeded.intake.setBinding({
      orgId: project.orgId,
      userId: project.createdBy,
      integrationId: 'gitlab',
      sourceId: SOURCE_ID,
      factoryProjectId: project.id,
      board: 'review',
    });
    await seeded.workItems.upsert({
      orgId: project.orgId,
      userId: project.createdBy,
      factoryProjectId: project.id,
      input: {
        externalSource: {
          integrationId: 'gitlab',
          type: 'pull-request',
          externalId: MERGE_REQUEST_SOURCE,
          url: `https://${HOST}/${PROJECT_PATH}/-/merge_requests/17`,
        },
        title: 'MR 17',
        stages: [initialStage],
        sessions: {},
        metadata: {
          ...(!missingIdentity && { gitlabHost: HOST, gitlabProjectId: 101 }),
          gitlabMergeRequestIid: 17,
          headBranch: 'feature-17',
          baseBranch: 'main',
          state: initialState,
          merged: false,
        },
      },
    });

    const closedPullRequest: PullRequest = {
      id: '17',
      title: 'MR 17',
      url: `https://${HOST}/${PROJECT_PATH}/-/merge_requests/17`,
      author: 'maintainer',
      assignees: [],
      requestedReviewers: ['reviewer'],
      labels: ['ready'],
      body: null,
      state: 'closed',
      draft: false,
      merged,
      mergeable: null,
      baseBranch: 'main',
      headBranch: 'feature-17',
      headSha: 'abc123',
      createdAt: '2026-09-01T00:00:00Z',
      updatedAt: '2026-09-18T00:00:00Z',
    };
    const getPullRequest = vi
      .fn<VersionControl['getPullRequest']>()
      .mockResolvedValueOnce(closedPullRequest)
      .mockResolvedValue(closedPullRequest);
    const getProjectMemberAccessLevel = vi.fn().mockResolvedValueOnce(40).mockResolvedValue(10);
    const gitlab = {
      versionControl: { getPullRequest } as VersionControl,
      rules: resolveGitLabRules(),
      getProjectMemberAccessLevel,
      getWorkItemAuthorUsername: vi.fn().mockResolvedValue('maintainer'),
      resolveActiveConnectionForHost: vi.fn().mockImplementation(async (connectionId: string) =>
        missingIdentity ? 'direct' : connectionId,
      ),
    };
    const context = {
      storage: { projects: seeded.projects, sourceControl, intake: seeded.intake },
      runtime: {
        configVersion: 'gitlab-test-v1',
        workItems: seeded.workItems,
        boards: createBoardRegistry(),
      },
    } as unknown as IntegrationContext;
    const commitRuleEvaluation = vi.spyOn(seeded.workItems, 'commitRuleEvaluation');
    const reconcile = attachGitLabMergeRequestReconciler(gitlab, context);

    await expect(reconcile?.()).resolves.toMatchObject({ checked: 1, closed: 1, failed: 0 });
    expect(commitRuleEvaluation).toHaveBeenCalledWith(
      expect.objectContaining({
        ingress: expect.objectContaining({
          identity: expect.stringContaining(`reconcile:merge-request:${HOST}:${PROJECT_ID}:17:`),
        }),
      }),
    );
    expect(getProjectMemberAccessLevel).toHaveBeenCalledWith('direct', PROJECT_ID, 'maintainer');
    await expect(reconcile?.()).resolves.toMatchObject({ checked: 1, closed: 1, failed: 0 });
    expect(getPullRequest).toHaveBeenCalledWith({
      connection: { type: 'oauth', accessToken: 'gitlab-connection:direct' },
      sourceId: PROJECT_ID,
      pullRequestId: '17',
    });
    const decisions = await seeded.workItems.listDeferredDecisions(project.orgId, project.id);
    expect(decisions).toHaveLength(1);
    expect(decisions[0]).toMatchObject({
      decision: { type: 'transition', board: 'review', stage: expectedStage },
    });
    const [item] = await seeded.workItems.list({ orgId: project.orgId, factoryProjectId: project.id });
    expect(item?.metadata).toMatchObject({ author: 'maintainer', authorTrusted: false, state: 'closed', merged });
  });
});
