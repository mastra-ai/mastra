import { describe, expect, it, vi } from 'vitest';

import { createBoardRegistry } from '../../boards/index.js';
import type { PullRequest, VersionControl } from '../../capabilities/version-control.js';
import { FACTORY_PULL_REQUEST_RECONCILIATION_KEY } from '../../storage/domains/work-items/base.js';
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

interface SeedOptions {
  initialStage: string;
  initialState: 'open' | 'closed';
  /** Leave the card without host/project metadata and without a direct-connection link. */
  missingIdentity?: boolean;
}

async function seedMergeRequestCard({ initialStage, initialState, missingIdentity = false }: SeedOptions) {
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
  const item = await seeded.workItems.upsert({
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
  return { seeded, sourceControl, project, item };
}

function closedMergeRequest(merged: boolean): PullRequest {
  return {
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
}

function createReconciler(
  seeded: Awaited<ReturnType<typeof seedMergeRequestCard>>,
  pullRequest: PullRequest,
  options: { missingIdentity?: boolean; accessLevel?: number } = {},
) {
  const getPullRequest = vi.fn<VersionControl['getPullRequest']>().mockResolvedValue(pullRequest);
  // Trust drops between sweeps by default so the second sweep has a metadata change to write.
  const getProjectMemberAccessLevel =
    options.accessLevel === undefined
      ? vi.fn().mockResolvedValueOnce(40).mockResolvedValue(10)
      : vi.fn().mockResolvedValue(options.accessLevel);
  const gitlab = {
    versionControl: { getPullRequest } as VersionControl,
    rules: resolveGitLabRules(),
    getProjectMemberAccessLevel,
    getWorkItemAuthorUsername: vi.fn().mockResolvedValue('maintainer'),
    resolveActiveConnectionForHost: vi
      .fn()
      .mockImplementation(async (connectionId: string) => (options.missingIdentity ? 'direct' : connectionId)),
  };
  const context = {
    storage: { projects: seeded.seeded.projects, sourceControl: seeded.sourceControl, intake: seeded.seeded.intake },
    runtime: {
      configVersion: 'gitlab-test-v1',
      workItems: seeded.seeded.workItems,
      boards: createBoardRegistry(),
    },
  } as unknown as IntegrationContext;
  const commitRuleEvaluation = vi.spyOn(seeded.seeded.workItems, 'commitRuleEvaluation');
  const reconcile = attachGitLabMergeRequestReconciler(gitlab, context);
  if (!reconcile) throw new Error('reconciler was not attached');
  return { reconcile, getPullRequest, getProjectMemberAccessLevel, commitRuleEvaluation };
}

describe('GitLab merge-request reconciler', () => {
  it.each([
    { initialStage: 'review', initialState: 'open', merged: true, expectedStage: 'done', missingIdentity: false },
    {
      initialStage: 'review',
      initialState: 'closed',
      merged: false,
      expectedStage: 'canceled',
      missingIdentity: false,
    },
    { initialStage: 'review', initialState: 'open', merged: false, expectedStage: 'canceled', missingIdentity: true },
  ] as const)(
    'replays a missed terminal outcome from $initialStage through governed rules',
    async ({ initialStage, initialState, merged, expectedStage, missingIdentity }) => {
      const seeded = await seedMergeRequestCard({ initialStage, initialState, missingIdentity });
      const { project } = seeded;
      const { reconcile, getPullRequest, getProjectMemberAccessLevel, commitRuleEvaluation } = createReconciler(
        seeded,
        closedMergeRequest(merged),
        { missingIdentity },
      );

      await expect(reconcile()).resolves.toMatchObject({ checked: 1, closed: 1, failed: 0 });
      expect(commitRuleEvaluation).toHaveBeenCalledWith(
        expect.objectContaining({
          ingress: expect.objectContaining({
            identity: expect.stringContaining(`reconcile:merge-request:${HOST}:${PROJECT_ID}:17:`),
          }),
        }),
      );
      expect(getProjectMemberAccessLevel).toHaveBeenCalledWith('direct', PROJECT_ID, 'maintainer');
      // A card still in Reviewing keeps being swept until the governed
      // transition lands, exactly as a GitHub card would.
      await expect(reconcile()).resolves.toMatchObject({ checked: 1, closed: 1, failed: 0 });
      expect(getPullRequest).toHaveBeenCalledWith({
        connection: { type: 'oauth', accessToken: 'gitlab-connection:direct' },
        sourceId: PROJECT_ID,
        pullRequestId: '17',
      });
      const decisions = await seeded.seeded.workItems.listDeferredDecisions(project.orgId, project.id);
      expect(decisions).toHaveLength(1);
      expect(decisions[0]).toMatchObject({
        decision: { type: 'transition', board: 'review', stage: expectedStage },
      });
      const [item] = await seeded.seeded.workItems.list({ orgId: project.orgId, factoryProjectId: project.id });
      expect(item?.metadata).toMatchObject({
        author: 'maintainer',
        authorTrusted: false,
        state: 'closed',
        merged,
        [FACTORY_PULL_REQUEST_RECONCILIATION_KEY]: merged ? 'merged' : 'closed',
      });
    },
  );

  it.each([
    { initialStage: 'done', merged: false, replayedStage: 'canceled' },
    { initialStage: 'canceled', merged: true, replayedStage: 'done' },
  ] as const)(
    'replays a provider outcome once for a $initialStage card and then leaves it settled',
    async ({ initialStage, merged, replayedStage }) => {
      const seeded = await seedMergeRequestCard({ initialStage, initialState: 'open' });
      const { project } = seeded;
      const cleanup = vi.spyOn(seeded.seeded.workItems, 'supersedeDecisionsForWorkItem');
      const { reconcile, getPullRequest, commitRuleEvaluation } = createReconciler(seeded, closedMergeRequest(merged));

      await expect(reconcile()).resolves.toMatchObject({ checked: 1, closed: 1, updated: 1, failed: 0 });
      expect(cleanup).toHaveBeenCalledTimes(1);
      expect(commitRuleEvaluation).toHaveBeenCalledTimes(1);
      const decisions = await seeded.seeded.workItems.listDeferredDecisions(project.orgId, project.id);
      expect(decisions).toHaveLength(1);
      expect(decisions[0]).toMatchObject({ decision: { type: 'transition', board: 'review', stage: replayedStage } });
      const [item] = await seeded.seeded.workItems.list({ orgId: project.orgId, factoryProjectId: project.id });
      expect(item?.stages).toEqual([initialStage]);
      expect(item?.metadata).toMatchObject({
        state: 'closed',
        merged,
        [FACTORY_PULL_REQUEST_RECONCILIATION_KEY]: merged ? 'merged' : 'closed',
      });

      // The stamped card is settled: no further fetch, replay, or write.
      await expect(reconcile()).resolves.toMatchObject({ checked: 0, closed: 0, updated: 0, failed: 0 });
      expect(getPullRequest).toHaveBeenCalledTimes(1);
      expect(commitRuleEvaluation).toHaveBeenCalledTimes(1);
      expect(cleanup).toHaveBeenCalledTimes(1);
    },
  );

  it('withholds the settled stamp while terminal decision cleanup fails, then retries', async () => {
    const seeded = await seedMergeRequestCard({ initialStage: 'done', initialState: 'open' });
    const { project } = seeded;
    const cleanup = vi
      .spyOn(seeded.seeded.workItems, 'supersedeDecisionsForWorkItem')
      .mockRejectedValueOnce(new Error('Decision cleanup failed'));
    const { reconcile, getPullRequest } = createReconciler(seeded, closedMergeRequest(false));

    await expect(reconcile()).resolves.toMatchObject({
      checked: 1,
      closed: 1,
      failed: 1,
      errors: [{ projectId: project.id, error: 'Decision cleanup failed' }],
    });
    let [item] = await seeded.seeded.workItems.list({ orgId: project.orgId, factoryProjectId: project.id });
    expect(item?.metadata).not.toHaveProperty(FACTORY_PULL_REQUEST_RECONCILIATION_KEY);

    await expect(reconcile()).resolves.toMatchObject({ checked: 1, closed: 1, failed: 0 });
    expect(cleanup).toHaveBeenCalledTimes(2);
    expect(getPullRequest).toHaveBeenCalledTimes(2);
    [item] = await seeded.seeded.workItems.list({ orgId: project.orgId, factoryProjectId: project.id });
    expect(item?.metadata).toMatchObject({ [FACTORY_PULL_REQUEST_RECONCILIATION_KEY]: 'closed' });

    await expect(reconcile()).resolves.toMatchObject({ checked: 0 });
  });

  it('clears a stale settled stamp when the merge request is reopened', async () => {
    const seeded = await seedMergeRequestCard({ initialStage: 'review', initialState: 'closed' });
    const { project } = seeded;
    await seeded.seeded.workItems.update({
      orgId: project.orgId,
      id: seeded.item.id,
      userId: 'user-1',
      patch: { metadata: { ...seeded.item.metadata, [FACTORY_PULL_REQUEST_RECONCILIATION_KEY]: 'closed' } },
    });
    const { reconcile } = createReconciler(
      seeded,
      { ...closedMergeRequest(false), state: 'open' },
      { accessLevel: 40 },
    );

    await expect(reconcile()).resolves.toMatchObject({ checked: 1, closed: 0, updated: 1, failed: 0 });
    const [item] = await seeded.seeded.workItems.list({ orgId: project.orgId, factoryProjectId: project.id });
    expect(item?.metadata).toMatchObject({ state: 'open' });
    expect(item?.metadata).not.toHaveProperty(FACTORY_PULL_REQUEST_RECONCILIATION_KEY);

    await expect(reconcile()).resolves.toMatchObject({ checked: 1, updated: 0 });
  });
});
