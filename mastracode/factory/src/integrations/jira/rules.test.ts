import { describe, expect, it, vi } from 'vitest';
import { createBoardRegistry } from '../../boards/index.js';
import { createTestBoard } from '../../boards/test-utils.js';
import { createFactoryStorageForTests } from '../../storage/test-utils.js';
import { jiraClaimKey } from './claim.js';
import { resolveJiraRules } from './default-rules.js';
import type { JiraRuleOverrides } from './default-rules.js';
import { JiraRules } from './rules.js';

const issue = {
  id: 'jira-issue:conn-1:ENG-42:10001',
  identifier: 'ENG-42',
  title: 'Fix intake sync',
  url: 'https://acme.atlassian.net/browse/ENG-42',
  state: 'To Do',
  stateType: 'unstarted',
  priorityLabel: 'High',
  assignee: 'ada',
  author: 'grace',
  project: 'ENG',
  site: 'acme.atlassian.net',
  labels: ['bug'],
  createdAt: '2026-07-01T00:00:00Z',
  updatedAt: '2026-07-02T00:00:00Z',
};

async function setup(overrides?: JiraRuleOverrides, boards = createBoardRegistry()) {
  const seeded = await createFactoryStorageForTests();
  const project = await seeded.projects.create({
    orgId: 'org-1',
    userId: 'user-1',
    input: { name: 'acme/repo' },
  });
  const service = new JiraRules({
    projects: seeded.projects,
    storage: seeded.workItems,
    configVersion: 'factory-config-v1',
    boards,
    jiraRules: resolveJiraRules(overrides),
  });
  return { project, service, workItems: seeded.workItems };
}

describe('JiraRules', () => {
  it.each([
    { name: 'the bound custom board initial phase', sourceId: '10001', board: 'release', stage: 'queued' },
    { name: 'Work triage when the source is unbound', sourceId: '10002', board: 'work', stage: 'triage' },
    {
      name: 'Work triage when the bound board is not installed',
      sourceId: '10003',
      board: 'work',
      stage: 'triage',
    },
  ])('routes an observed issue to $name', async ({ sourceId, board, stage }) => {
    const { project, service, workItems } = await setup(
      undefined,
      createBoardRegistry({ boards: [createTestBoard()] }),
    );
    await service.ingest({
      orgId: 'org-1',
      userId: 'user-1',
      factoryProjectId: project.id,
      issues: [{ ...issue, sourceId }],
      intakeBoards: { '10001': 'release', '10003': 'hotfix' },
    });
    expect(await workItems.listDeferredDecisions('org-1', project.id)).toMatchObject([
      { decision: { type: 'upsertLinkedWorkItem', board, stage } },
    ]);
  });

  it('stamps the card with the intake metadata the board renders', async () => {
    const { project, service, workItems } = await setup();
    await service.ingest({ orgId: 'org-1', userId: 'user-1', factoryProjectId: project.id, issues: [issue] });
    expect(await workItems.listDeferredDecisions('org-1', project.id)).toMatchObject([
      {
        decision: {
          type: 'upsertLinkedWorkItem',
          source: 'jira-issue',
          sourceKey: issue.id,
          claimKey: jiraClaimKey(issue.id),
          title: issue.title,
          url: issue.url,
          metadata: {
            identifier: 'ENG-42',
            issueRef: issue.id,
            state: 'To Do',
            stateType: 'unstarted',
            priority: 'High',
            project: 'ENG',
            site: 'acme.atlassian.net',
            assignee: 'ada',
            assignees: ['ada'],
            creator: 'grace',
            author: 'grace',
            labels: ['bug'],
          },
        },
      },
    ]);
  });

  it('does not mint a second card while another Factory holds a live card for the issue', async () => {
    const { project, service, workItems } = await setup();
    await workItems.upsert({
      orgId: 'org-1',
      userId: 'user-1',
      factoryProjectId: 'other-factory',
      input: {
        externalSource: {
          integrationId: 'jira',
          type: 'issue',
          externalId: issue.id,
          url: issue.url,
        },
        title: issue.title,
        stages: ['intake'],
        sessions: {},
        metadata: {},
      },
    });

    await expect(
      service.ingest({ orgId: 'org-1', userId: 'user-1', factoryProjectId: project.id, issues: [issue] }),
    ).resolves.toEqual({ status: 'missing', ingested: 1 });

    expect(await workItems.listDeferredDecisions('org-1', project.id)).toEqual([]);
    expect(await workItems.list({ orgId: 'org-1', factoryProjectId: project.id })).toEqual([]);
  });

  it('ingests an issue again once the other Factory finished its card', async () => {
    const { project, service, workItems } = await setup();
    await workItems.upsert({
      orgId: 'org-1',
      userId: 'user-1',
      factoryProjectId: 'other-factory',
      input: {
        externalSource: {
          integrationId: 'jira',
          type: 'issue',
          externalId: issue.id,
          url: issue.url,
        },
        title: issue.title,
        stages: ['done'],
        sessions: {},
        metadata: {},
      },
    });

    await expect(
      service.ingest({ orgId: 'org-1', userId: 'user-1', factoryProjectId: project.id, issues: [issue] }),
    ).resolves.toEqual({ status: 'committed', ingested: 1 });

    expect(await workItems.listDeferredDecisions('org-1', project.id)).toMatchObject([
      {
        decision: {
          type: 'upsertLinkedWorkItem',
          sourceKey: issue.id,
          claimKey: jiraClaimKey(issue.id),
        },
      },
    ]);
  });

  it('finds the held card by claim key when the stored source key drifted', async () => {
    const { project, service, workItems } = await setup();
    await workItems.upsert({
      orgId: 'org-1',
      userId: 'user-1',
      factoryProjectId: 'other-factory',
      input: {
        externalSource: { integrationId: 'jira', type: 'issue', externalId: 'jira-issue:old-ref', url: issue.url },
        claimKey: jiraClaimKey(issue.id),
        title: 'OLD-1: Fix intake sync',
        stages: ['intake'],
        sessions: {},
        metadata: {},
      },
    });

    await expect(
      service.ingest({ orgId: 'org-1', userId: 'user-1', factoryProjectId: project.id, issues: [issue] }),
    ).resolves.toEqual({ status: 'missing', ingested: 1 });
    expect(await workItems.listDeferredDecisions('org-1', project.id)).toEqual([]);
  });

  it.each(['completed', 'canceled'])('closes linked issues in state %s with shared audit metadata', async stateType => {
    const { project, service, workItems } = await setup();
    await workItems.upsert({
      orgId: 'org-1',
      userId: 'user-1',
      factoryProjectId: project.id,
      input: {
        title: issue.title,
        stages: ['planning'],
        sessions: {},
        externalSource: { integrationId: 'jira', type: 'issue', externalId: issue.id, url: issue.url },
      },
    });
    const commit = vi.spyOn(workItems, 'commitRuleEvaluation');
    await service.ingest({
      orgId: 'org-1',
      userId: 'user-1',
      factoryProjectId: project.id,
      issues: [{ ...issue, stateType }],
    });
    expect(commit).toHaveBeenCalledWith(
      expect.objectContaining({
        configVersion: 'factory-config-v1',
        ingress: { identity: `jira:${issue.id}:${issue.updatedAt}`, triggerType: 'jira.issueObserved' },
      }),
    );
    expect(await workItems.listDeferredDecisions('org-1', project.id)).toMatchObject([
      { decision: { type: 'transition', stage: stateType === 'completed' ? 'done' : 'canceled' } },
    ]);
  });

  it.each(['completed', 'canceled'])(
    'does not invoke overrides or create intake for unlinked %s issues',
    async stateType => {
      const handler = vi.fn();
      const { project, service, workItems } = await setup({ issueClosed: handler });
      await expect(
        service.ingest({
          orgId: 'org-1',
          userId: 'user-1',
          factoryProjectId: project.id,
          issues: [{ ...issue, stateType }],
        }),
      ).resolves.toEqual({ status: 'missing', ingested: 1 });
      expect(handler).not.toHaveBeenCalled();
      expect(await workItems.listDeferredDecisions('org-1', project.id)).toEqual([]);
    },
  );

  it('retains ingestion bookkeeping when an event is disabled', async () => {
    const { project, service, workItems } = await setup({ issueObserved: null });
    const input = { orgId: 'org-1', userId: 'user-1', factoryProjectId: project.id, issues: [issue] };
    await expect(service.ingest(input)).resolves.toEqual({ status: 'committed', ingested: 1 });
    expect(await workItems.listDeferredDecisions('org-1', project.id)).toEqual([]);
    // Replaying the same ingress is idempotent — nothing new is committed.
    await expect(service.ingest(input)).resolves.toEqual({ status: 'replayed', ingested: 1 });
  });

  it('reports missing when the Factory project does not exist', async () => {
    const { service } = await setup();
    await expect(
      service.ingest({ orgId: 'org-1', userId: 'user-1', factoryProjectId: 'nope', issues: [issue] }),
    ).resolves.toEqual({ status: 'missing', ingested: 0 });
  });

  it('rejects an uninstalled linked target before accepting effects', async () => {
    const { project, service, workItems } = await setup(
      {
        issueObserved: () => ({
          type: 'upsertLinkedWorkItem',
          idempotencyKey: 'invalid-target',
          board: 'missing',
          stage: 'shipping',
          source: 'jira-issue',
          sourceKey: issue.id,
          title: issue.title,
          url: issue.url,
        }),
      },
      createBoardRegistry({ boards: [createTestBoard()] }),
    );
    const commit = vi.spyOn(workItems, 'commitRuleEvaluation');
    await service.ingest({ orgId: 'org-1', userId: 'user-1', factoryProjectId: project.id, issues: [issue] });
    expect(commit).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: expect.objectContaining({ status: 'rejected', code: 'rule_error' }),
        decisions: [],
      }),
    );
    expect(await workItems.listDeferredDecisions('org-1', project.id)).toEqual([]);
    expect(await workItems.list({ orgId: 'org-1', factoryProjectId: project.id })).toEqual([]);
  });
});
