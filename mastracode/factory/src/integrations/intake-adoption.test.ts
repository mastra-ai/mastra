/**
 * Filing must adopt the candidate, on every provider: the record a pass offers and the card the
 * provider's own rules file for it have to name the record the same way, or the board would hold
 * a card and Intake would keep offering the same record beside it. Real storage, rules and
 * dispatcher; only the provider's listing is faked.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createBoardRegistry } from '../boards/index.js';
import type { IntakeIssue, IntakeItem } from '../capabilities/intake.js';
import type { PullRequest } from '../capabilities/version-control.js';
import { FactoryDecisionDispatcher } from '../rules/dispatcher.js';
import { FactoryTransitionService } from '../rules/transition-service.js';
import { createFactoryStorageForTests } from '../storage/test-utils.js';
import type { IntegrationContext } from './base.js';
import { attachGitLabIntakePasses } from './gitlab/intake-pass.js';
import { encodeSourceId, GitLabIntegration } from './gitlab/integration.js';
import { attachGitLabRules } from './gitlab/rules.js';
import { resolveIncidentioRules } from './incidentio/default-rules.js';
import { attachIncidentioIntakePass } from './incidentio/intake-pass.js';
import { INCIDENTIO_FOLLOW_UPS_SOURCE_ID } from './incidentio/intake.js';
import type { IntakePass } from './intake-pass.js';
import { resolveLinearRules } from './linear/default-rules.js';
import { attachLinearIntakePass } from './linear/intake-pass.js';

const ORG = 'org-1';
const CREATED = '2030-01-01T00:00:00Z';

async function setup(integrationId: string) {
  const seed = await createFactoryStorageForTests();
  const project = await seed.projects.create({ orgId: ORG, userId: 'user-1', input: { name: 'Factory' } });
  const boards = createBoardRegistry();
  const scope = { orgId: ORG, factoryProjectId: project.id };
  const context = {
    storage: {
      generic: seed.integrations.forIntegration(integrationId),
      sourceControl: seed.sourceControl.forIntegration(integrationId),
      projects: seed.projects,
      intake: seed.intake,
    },
    runtime: { configVersion: 'factory-config-v1', workItems: seed.workItems, boards },
  } as unknown as IntegrationContext;
  const bind = async (sourceId: string) => {
    await seed.intake.saveConfig({ orgId: ORG, config: { [integrationId]: { enabled: true, sourceIds: [sourceId] } } });
    await seed.intake.setBinding({
      orgId: ORG,
      userId: 'user-1',
      integrationId,
      sourceId,
      factoryProjectId: project.id,
    });
  };
  const candidates = async () => (await seed.workItems.listIntakeCandidates({ ...scope, limit: 100 })).candidates;
  const fileProposedCards = () =>
    new FactoryDecisionDispatcher({
      controller: {} as never,
      storage: seed.workItems,
      boards,
      transitionService: new FactoryTransitionService({
        storage: seed.workItems,
        boards,
        configVersion: 'factory-config-v1',
      }),
      factoryProjectExists: async () => true,
      ownerId: 'intake-adoption-test',
    }).runOnce(new Date(Date.now() + 1_000));

  /** One pass, the filing of what the rules proposed, and a second pass over the same listing. */
  const offerAndFile = async (pass: IntakePass) => {
    expect(await pass()).toMatchObject({ failed: 0, offered: 1, stored: 1 });
    const [candidate] = await candidates();
    await fileProposedCards();
    const cards = await seed.workItems.list(scope);
    expect(await pass()).toMatchObject({ failed: 0, offered: 0, stored: 0, removed: 0 });
    return { candidate, cards, left: await candidates() };
  };

  return { seed, project, scope, context, bind, candidates, offerAndFile };
}

async function linkGitLabRepository(t: Awaited<ReturnType<typeof setup>>) {
  const sourceControl = t.seed.sourceControl.forIntegration('gitlab');
  const installation = await sourceControl.installations.upsert({
    orgId: ORG,
    connectedByUserId: 'user-1',
    externalId: 'direct',
    providerMetadata: { host: 'gitlab.example.com' },
  });
  const repository = await sourceControl.repositories.upsert({
    orgId: ORG,
    input: { installationId: installation.id, externalId: '101', slug: 'acme/app', defaultBranch: 'main' },
  });
  const connection = await sourceControl.connections.create({
    orgId: ORG,
    factoryProjectId: t.project.id,
    installationId: installation.id,
    createdByUserId: 'user-1',
  });
  await sourceControl.projectRepositories.link({
    orgId: ORG,
    connectionId: connection.id,
    repositoryId: repository.id,
    createdByUserId: 'user-1',
    sandboxProvider: 'local',
    sandboxWorkdir: '/workspace',
  });
  const sourceId = encodeSourceId({ host: 'gitlab.example.com', projectId: '101' });
  await t.bind(sourceId);

  const gitlab = new GitLabIntegration({ accessToken: 'group-token' });
  vi.spyOn(gitlab, 'resolveOrgId').mockResolvedValue(ORG);
  vi.spyOn(gitlab, 'getLinkedRepository').mockResolvedValue({ repository, host: 'gitlab.example.com' });
  vi.spyOn(gitlab.versionControl, 'getRepositoryTarget').mockResolvedValue({
    connection: { type: 'oauth', accessToken: 'gitlab-connection:direct' },
    sourceId: '101:acme/app',
  });
  vi.spyOn(gitlab, 'getProjectMemberAccessLevel').mockResolvedValue(40);
  vi.spyOn(gitlab, 'getWorkItemAuthorUsername').mockResolvedValue('maintainer');
  vi.spyOn(gitlab, 'resolveActiveConnectionForHost').mockResolvedValue('direct');
  const listIssues = vi.spyOn(gitlab.intake, 'listIssues').mockResolvedValue({ issues: [], nextCursor: null });
  const listPullRequests = vi
    .spyOn(gitlab.versionControl, 'listPullRequests')
    .mockResolvedValue({ pullRequests: [], nextCursor: null });
  const [issues, mergeRequests] = attachGitLabIntakePasses(gitlab, t.context);
  return { gitlab, sourceId, listIssues, listPullRequests, issues: issues!, mergeRequests: mergeRequests! };
}

const gitlabIssue = (sourceId: string): IntakeIssue =>
  ({
    id: '5',
    identifier: '#5',
    title: 'GitLab issue 5',
    url: 'https://gitlab.example.com/acme/app/-/issues/5',
    author: 'Maintainer',
    authorUsername: 'maintainer',
    state: 'opened',
    stateType: 'unstarted',
    priority: null,
    assignee: null,
    assignees: [],
    source: 'acme/app',
    sourceId,
    labels: [],
    commentCount: 0,
    createdAt: CREATED,
    updatedAt: CREATED,
  }) as IntakeIssue;

afterEach(() => {
  vi.restoreAllMocks();
});

describe('a card filed for a record a pass offered', () => {
  it('keeps the work item of a Linear issue', async () => {
    const t = await setup('linear');
    await t.bind('proj-1');
    const issue = {
      id: 'issue-1',
      identifier: 'ENG-42',
      title: 'Linear issue',
      url: 'https://linear.app/acme/issue/ENG-42',
      author: 'grace',
      state: 'Todo',
      stateType: 'unstarted',
      priority: 'High',
      assignee: null,
      source: 'ENG',
      sourceId: 'proj-1',
      projectId: 'proj-1',
      labels: ['bug'],
      commentCount: 0,
      createdAt: CREATED,
      updatedAt: CREATED,
    } as IntakeIssue;
    const pass = attachLinearIntakePass(
      {
        rules: resolveLinearRules(),
        intake: { listIssues: async () => ({ issues: [issue], nextCursor: null }) },
        loadConnection: async () => ({ orgId: ORG }),
        getFreshAccessToken: async () => 'token',
      } as never,
      t.context,
    )!;

    const { candidate, cards, left } = await t.offerAndFile(pass);

    expect(cards.map(card => card.workItem.id)).toEqual([candidate!.workItemId]);
    expect(left).toEqual([]);
  });

  it('keeps the work item of an incident.io follow-up', async () => {
    const t = await setup('incidentio');
    await t.bind(INCIDENTIO_FOLLOW_UPS_SOURCE_ID);
    const followUp = {
      source: {
        type: 'issue',
        externalId: 'incidentio:follow-up:fu-1',
        url: 'https://app.incident.io/follow-ups/fu-1',
      },
      sourceId: INCIDENTIO_FOLLOW_UPS_SOURCE_ID,
      title: 'Write the runbook',
      status: 'Outstanding',
      labels: [],
      assignee: null,
      createdAt: CREATED,
      updatedAt: CREATED,
      metadata: { identifier: 'FU-1', stateType: 'unstarted', author: 'grace', priority: 'High' },
    } as unknown as IntakeItem;
    const pass = attachIncidentioIntakePass(
      {
        rules: resolveIncidentioRules(),
        intake: { listItems: async () => ({ items: [followUp], nextCursor: null }) },
      },
      t.context,
    )!;

    const { candidate, cards, left } = await t.offerAndFile(pass);

    expect(cards.map(card => card.workItem.id)).toEqual([candidate!.workItemId]);
    expect(left).toEqual([]);
  });

  it('keeps the work item of a GitLab issue', async () => {
    const t = await setup('gitlab');
    const gitlab = await linkGitLabRepository(t);
    gitlab.listIssues.mockResolvedValue({ issues: [gitlabIssue(gitlab.sourceId)], nextCursor: null });

    const { candidate, cards, left } = await t.offerAndFile(gitlab.issues);

    expect(cards.map(card => card.workItem.id)).toEqual([candidate!.workItemId]);
    expect(left).toEqual([]);
  });

  it('keeps the work item of a GitLab merge request', async () => {
    const t = await setup('gitlab');
    const gitlab = await linkGitLabRepository(t);
    const mergeRequest = {
      id: '18',
      title: 'Outside merge request',
      url: 'https://gitlab.example.com/acme/app/-/merge_requests/18',
      author: 'maintainer',
      assignees: [],
      requestedReviewers: [],
      labels: [],
      body: '',
      state: 'open',
      draft: false,
      merged: false,
      mergeable: true,
      baseBranch: 'main',
      headBranch: 'feature',
      headSha: 'aaaa',
      createdAt: CREATED,
      updatedAt: CREATED,
    } as PullRequest;
    gitlab.listPullRequests.mockResolvedValue({ pullRequests: [mergeRequest], nextCursor: null });

    const { candidate, cards, left } = await t.offerAndFile(gitlab.mergeRequests);

    expect(cards.map(card => card.workItem.id)).toEqual([candidate!.workItemId]);
    expect(left).toEqual([]);
  });
});

describe('a GitLab event and the Intake candidates', () => {
  it('stops offering an issue the moment GitLab closes it', async () => {
    const t = await setup('gitlab');
    const gitlab = await linkGitLabRepository(t);
    gitlab.listIssues.mockResolvedValue({
      issues: [{ ...gitlabIssue(gitlab.sourceId), createdAt: '2020-01-01T00:00:00Z' }],
      nextCursor: null,
    });
    // The second pass is the one that finds the source already imported and only offers the issue.
    await gitlab.issues();
    expect(await t.candidates()).toHaveLength(1);

    await attachGitLabRules(gitlab.gitlab, t.context)!({
      event: 'Issue Hook',
      deliveryId: 'delivery-close-5',
      instanceHost: 'gitlab.example.com',
      payload: {
        user_username: 'maintainer',
        project: { id: 101, path_with_namespace: 'acme/app', web_url: 'https://gitlab.example.com/acme/app' },
        object_attributes: {
          iid: 5,
          action: 'close',
          state: 'closed',
          title: 'GitLab issue 5',
          url: 'https://gitlab.example.com/acme/app/-/issues/5',
        },
      },
    });

    expect(await t.candidates()).toEqual([]);
  });
});
