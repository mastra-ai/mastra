/**
 * Filing a record from the Intake list the way the board does: read it from the list route, send
 * its source, title and facts to the card route. Real storage and both real routes; each record is
 * the one its provider's pass stores.
 */
import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';

import { createBoardRegistry } from '../boards/index.js';
import type { IntakeIssue } from '../capabilities/intake.js';
import type { PullRequest } from '../capabilities/version-control.js';
import { githubIssueRecord, githubPullRequestRecord } from '../integrations/github/intake-candidates.js';
import { gitlabIssueRecord, gitlabMergeRequestRecord } from '../integrations/gitlab/intake-pass.js';
import { encodeSourceId } from '../integrations/gitlab/integration.js';
import { incidentioIntakeRecord } from '../integrations/incidentio/intake-pass.js';
import type { IntakeRecord } from '../integrations/intake-pass.js';
import { jiraIntakeRecord } from '../integrations/jira/intake-pass.js';
import { linearIntakeRecord } from '../integrations/linear/intake-pass.js';
import { FactoryTransitionService } from '../rules/transition-service.js';
import { createFactoryStorageForTests } from '../storage/test-utils.js';
import { buildIntakeCandidateRoutes } from './intake-candidates.js';
import { fakeRouteAuth, mountApiRoutes } from './test-utils.js';
import { WorkItemRoutes } from './work-items.js';

const ORG = 'org-1';
const CREATED = '2026-07-01T00:00:00Z';

interface ListedCandidate {
  workItemId: string;
  title: string;
  externalSource: { integrationId: string; type: string; externalId: string; url?: string };
  key: string | null;
  metadata: Record<string, unknown>;
}

const listedIssue = (overrides: Partial<IntakeIssue>): IntakeIssue =>
  ({
    id: '7',
    identifier: 'ENG-7',
    title: 'Fix the login flow',
    url: 'https://tracker.test/ENG-7',
    author: 'grace',
    state: 'Todo',
    stateType: 'unstarted',
    priority: 'High',
    assignee: 'ada',
    assignees: ['ada'],
    source: 'ENG',
    labels: ['bug'],
    commentCount: 0,
    createdAt: CREATED,
    updatedAt: CREATED,
    ...overrides,
  }) as IntakeIssue;

const trackerIssue = {
  identifier: 'OPS-7',
  title: 'Fix the login flow',
  url: 'https://tracker.test/OPS-7',
  state: 'To Do',
  stateType: 'unstarted',
  priorityLabel: 'High',
  assignee: 'ada',
  author: 'grace',
  labels: ['bug'],
  createdAt: CREATED,
  updatedAt: CREATED,
};

const gitlabProject = { host: 'gitlab.com', projectId: 42, projectPath: 'acme/app' };

const records: Array<[provider: string, record: IntakeRecord]> = [
  [
    'a GitHub issue',
    githubIssueRecord(10, {
      number: 7,
      title: 'Fix the login flow',
      url: 'https://github.com/acme/app/issues/7',
      author: 'grace',
      assignees: ['ada'],
      labels: ['bug'],
      createdAt: CREATED,
    }),
  ],
  [
    'a GitHub pull request',
    githubPullRequestRecord(10, {
      number: 8,
      title: 'Add rate limiting',
      url: 'https://github.com/acme/app/pull/8',
      author: 'grace',
      assignees: [],
      requestedReviewers: ['ada'],
      labels: [],
      headBranch: 'rate-limiting',
      baseBranch: 'main',
      createdAt: CREATED,
    }),
  ],
  [
    'a GitLab issue',
    gitlabIssueRecord(
      listedIssue({
        identifier: 'acme/app#7',
        url: 'https://gitlab.com/acme/app/-/issues/7',
        sourceId: encodeSourceId({ host: gitlabProject.host, projectId: String(gitlabProject.projectId) }),
      }),
    )!,
  ],
  [
    'a GitLab merge request',
    gitlabMergeRequestRecord({
      project: gitlabProject,
      mergeRequest: {
        id: '8',
        title: 'Add rate limiting',
        url: 'https://gitlab.com/acme/app/-/merge_requests/8',
        author: 'grace',
        assignees: [],
        requestedReviewers: ['ada'],
        labels: [],
        headBranch: 'rate-limiting',
        baseBranch: 'main',
        createdAt: CREATED,
      } as unknown as PullRequest,
    }),
  ],
  ['a Linear issue', linearIntakeRecord(listedIssue({ id: 'linear-issue-7', projectId: 'linear-project-1' }))],
  ['a Jira issue', jiraIntakeRecord({ ...trackerIssue, id: '10007', project: 'OPS', site: 'acme.atlassian.net' })],
  [
    'an incident.io follow-up',
    incidentioIntakeRecord({ ...trackerIssue, id: 'incidentio:follow-up:01HZ', identifier: 'FU-7', incident: 'INC-1' }),
  ],
];

async function setup() {
  const seed = await createFactoryStorageForTests();
  const project = await seed.projects.create({ orgId: ORG, userId: 'user-alice', input: { name: 'Project 1' } });
  const scope = { orgId: ORG, factoryProjectId: project.id };
  const boards = createBoardRegistry();
  const app = new Hono();
  app.use('*', async (c, next) => {
    c.set('factoryAuthUser' as never, { workosId: 'user-alice', organizationId: ORG } as never);
    await next();
  });
  mountApiRoutes(app as never, [
    ...buildIntakeCandidateRoutes({
      auth: fakeRouteAuth(),
      projects: seed.projects,
      workItems: seed.workItems,
      settings: seed.integrations,
    }),
    ...new WorkItemRoutes({
      auth: fakeRouteAuth(),
      audit: { emit: async () => {} },
      projects: seed.projects,
      workItems: seed.workItems,
      boardRegistry: boards,
      queueHealth: seed.queueHealth,
      transitionService: new FactoryTransitionService({
        configVersion: 'factory-config-v1',
        storage: seed.workItems,
        boards,
      }),
      liveSessions: { isRunning: () => false, parked: () => undefined, parkedIn: () => [] },
    }).routes(),
  ]);

  const listed = async () => {
    const response = await app.request(`/web/factory/projects/${project.id}/intake/candidates`);
    expect(response.status).toBe(200);
    return ((await response.json()) as { candidates: ListedCandidate[] }).candidates;
  };
  /** The request the board sends when a person files a listed record: nothing but what the list gave it. */
  const file = (candidate: ListedCandidate) =>
    app.request(`/web/factory/projects/${project.id}/work-items`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        externalSource: candidate.externalSource,
        title: candidate.title,
        stages: ['intake'],
        metadata: candidate.metadata,
      }),
    });
  return { seed, scope, app, listed, file };
}

describe('filing a record from the Intake list', () => {
  it.each(records)('files %s as a card on the record the list held', async (_provider, record) => {
    const t = await setup();
    expect(await t.seed.workItems.storeIntakeCandidate({ ...t.scope, ...record })).toBe('created');
    const [candidate] = await t.listed();
    expect(candidate).toMatchObject({ title: record.title, externalSource: record.source });

    const response = await t.file(candidate!);

    expect(response.status).toBe(200);
    const cards = await t.seed.workItems.list(t.scope);
    expect(cards).toHaveLength(1);
    expect(cards[0]).toMatchObject({ externalSource: record.source, stages: ['intake'] });
    expect(cards[0]?.workItem).toMatchObject({ id: candidate!.workItemId, key: candidate!.key, title: record.title });
    expect(await t.listed()).toEqual([]);
  });

  it.each(records)('files %s once when the board sends the request twice', async (_provider, record) => {
    const t = await setup();
    await t.seed.workItems.storeIntakeCandidate({ ...t.scope, ...record });
    const [candidate] = await t.listed();

    const responses = await Promise.all([t.file(candidate!), t.file(candidate!)]);

    expect(responses.map(response => response.status)).toEqual([200, 200]);
    const cards = await t.seed.workItems.list(t.scope);
    expect(cards.map(card => card.workItem?.id)).toEqual([candidate!.workItemId]);
    expect(await t.listed()).toEqual([]);
  });
});

describe('the Intake list beside edits to the board', () => {
  it('keeps every record when a phase changes kind and intake routes are added and removed', async () => {
    const t = await setup();
    for (const [, record] of records) await t.seed.workItems.storeIntakeCandidate({ ...t.scope, ...record });
    const before = await t.listed();
    expect(before).toHaveLength(records.length);
    const announced = vi.fn();
    t.seed.workItems.onIntakeChanged(announced);

    await t.seed.boards.seedBoards(t.scope, [
      {
        key: 'work',
        name: 'Work',
        phases: [
          { key: 'intake', name: 'Intake', kind: 'resting', nextPhases: ['done'] },
          { key: 'done', name: 'Done', kind: 'resting', nextPhases: [] },
        ],
      },
    ]);
    await t.seed.boards.replace(
      t.scope,
      'work',
      {
        name: 'Work',
        phases: [
          { key: 'intake', name: 'Intake', kind: 'resting', nextPhases: ['done'] },
          { key: 'done', name: 'Done', kind: 'terminal', nextPhases: [] },
        ],
      },
      { expectedRevision: 1, actor: 'user-alice' },
    );
    const route = await t.seed.boards.createIntakeRoute(
      t.scope,
      { name: 'New records', target: { boardKey: 'work', phaseKey: 'intake' } },
      'user-alice',
    );
    await t.seed.boards.deleteIntakeRoute(t.scope, route.id, { expectedRevision: route.revision });

    expect(await t.listed()).toEqual(before);
    expect(announced).not.toHaveBeenCalled();
  });
});
