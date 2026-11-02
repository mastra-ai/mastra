import { describe, expect, it, vi } from 'vitest';
import { createBoardRegistry } from '../../boards/index.js';
import { createTestBoard } from '../../boards/test-utils.js';
import { FactoryDecisionDispatcher } from '../../rules/dispatcher.js';
import { FactoryTransitionService } from '../../rules/transition-service.js';
import { createFactoryStorageForTests } from '../../storage/test-utils.js';
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
  const other = await seeded.projects.create({ orgId: 'org-1', userId: 'user-1', input: { name: 'acme/other' } });
  const service = new JiraRules({
    projects: seeded.projects,
    storage: seeded.workItems,
    configVersion: 'factory-config-v1',
    boards,
    jiraRules: resolveJiraRules(overrides),
  });
  const dispatcher = new FactoryDecisionDispatcher({
    controller: {} as never,
    storage: seeded.workItems,
    boards,
    transitionService: new FactoryTransitionService({
      storage: seeded.workItems,
      boards,
      configVersion: 'factory-config-v1',
    }),
    isAutoRunEnabled: async () => false,
    ownerId: 'jira-rules-test',
  });
  /** Files every committed decision, as the dispatcher's poll would. */
  const drain = () => dispatcher.runOnce(new Date(Date.now() + 60_000));
  const cardsFor = async (factoryProjectId: string) =>
    (await seeded.workItems.list({ orgId: 'org-1', factoryProjectId })).filter(
      item => item.externalSource?.externalId === issue.id,
    );
  return { project, other, service, workItems: seeded.workItems, drain, cardsFor };
}

describe('JiraRules', () => {
  it.each([
    { name: 'the bound custom board initial phase', sourceId: '10001', board: 'release', stage: 'queued' },
    { name: 'Work Intake when the source is unbound', sourceId: '10002', board: 'work', stage: 'intake' },
    {
      name: 'Work Intake when the bound board is not installed',
      sourceId: '10003',
      board: 'work',
      stage: 'intake',
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
    const [entry] = await workItems.listDeferredDecisions('org-1', project.id);
    expect(entry?.decision).not.toHaveProperty('claimKey');
  });

  it('files the same Jira issue in a second project while the first still holds a live card', async () => {
    const { project, other, service, drain, cardsFor } = await setup();
    for (const factoryProjectId of [other.id, project.id]) {
      await expect(
        service.ingest({ orgId: 'org-1', userId: 'user-1', factoryProjectId, issues: [issue] }),
      ).resolves.toEqual({ status: 'committed', ingested: 1 });
      await drain();
    }

    const [held] = await cardsFor(other.id);
    expect(held?.stages).toEqual(['intake']);
    expect(await cardsFor(other.id)).toHaveLength(1);
    expect(await cardsFor(project.id)).toHaveLength(1);
    expect((await cardsFor(project.id))[0]?.id).not.toBe(held?.id);
  });

  it('re-observing an issue in the same project reuses its card, also after it finished', async () => {
    const { project, service, workItems, drain, cardsFor } = await setup();
    const ingest = (observed: typeof issue) =>
      service.ingest({ orgId: 'org-1', userId: 'user-1', factoryProjectId: project.id, issues: [observed] });
    await ingest(issue);
    await drain();
    const [card] = await cardsFor(project.id);
    expect(card).toBeDefined();

    await workItems.update({ orgId: 'org-1', id: card!.id, userId: 'user-1', patch: { stages: ['done'] } });
    await expect(ingest({ ...issue, updatedAt: '2026-07-03T00:00:00Z' })).resolves.toEqual({
      status: 'committed',
      ingested: 1,
    });
    await drain();

    const cards = await cardsFor(project.id);
    expect(cards.map(item => [item.id, item.stages])).toEqual([[card!.id, ['done']]]);
    // The rules resolved the card, so the re-observation asked for no second one.
    const upserts = (await workItems.listDeferredDecisions('org-1', project.id)).filter(
      entry => entry.decision.type === 'upsertLinkedWorkItem',
    );
    expect(upserts).toHaveLength(1);
  });

  it('a reopened issue finds its card', async () => {
    const { project, service, workItems, drain, cardsFor } = await setup();
    const ingest = (observed: typeof issue) =>
      service.ingest({ orgId: 'org-1', userId: 'user-1', factoryProjectId: project.id, issues: [observed] });
    await ingest(issue);
    await drain();
    const [card] = await cardsFor(project.id);

    await ingest({ ...issue, state: 'Done', stateType: 'completed', updatedAt: '2026-07-03T00:00:00Z' });
    await drain();
    expect((await cardsFor(project.id)).map(item => item.stages)).toEqual([['done']]);

    const evaluate = vi.spyOn(workItems, 'commitRuleEvaluation');
    await ingest({ ...issue, state: 'To Do', stateType: 'unstarted', updatedAt: '2026-07-04T00:00:00Z' });
    await drain();

    expect(evaluate).toHaveBeenCalledWith(
      expect.objectContaining({ workItemId: card!.id, decisions: [] }),
    );
    const upserts = (await workItems.listDeferredDecisions('org-1', project.id)).filter(
      entry => entry.decision.type === 'upsertLinkedWorkItem',
    );
    expect(upserts).toHaveLength(1);
    expect((await cardsFor(project.id)).map(item => item.id)).toEqual([card!.id]);
  });

  it('ingests an issue again once the other Factory finished its card', async () => {
    const { project, other, service, workItems } = await setup();
    await workItems.upsert({
      orgId: 'org-1',
      userId: 'user-1',
      factoryProjectId: other.id,
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
        },
      },
    ]);
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
