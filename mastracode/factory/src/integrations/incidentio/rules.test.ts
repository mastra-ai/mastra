import { describe, expect, it, vi } from 'vitest';
import { createBoardRegistry } from '../../boards/index.js';
import { createTestBoard } from '../../boards/test-utils.js';
import type { FactoryIncidentioRuleContext } from '../../rules/types.js';
import { createFactoryStorageForTests } from '../../storage/test-utils.js';
import { resolveIncidentioRules } from './default-rules.js';
import type { IncidentioRuleOverrides } from './default-rules.js';
import { IncidentioRules } from './rules.js';

const issue = {
  id: 'incidentio:follow-up:01HFOLLOWUP',
  identifier: 'INC-42',
  title: 'Add database failover alert',
  url: 'https://app.incident.io/org/follow-ups/01HFOLLOWUP',
  state: 'outstanding',
  stateType: 'unstarted',
  priorityLabel: 'Urgent',
  assignee: 'Grace Hopper',
  author: 'Ada Lovelace',
  incident: 'INC-42',
  labels: ['reliability'],
  createdAt: '2026-09-02T10:00:00Z',
  updatedAt: '2026-09-02T12:00:00Z',
};

async function setup(overrides?: IncidentioRuleOverrides, boards = createBoardRegistry()) {
  const seeded = await createFactoryStorageForTests();
  const project = await seeded.projects.create({
    orgId: 'org-1',
    userId: 'user-1',
    input: { name: 'acme/repo' },
  });
  const service = new IncidentioRules({
    projects: seeded.projects,
    storage: seeded.workItems,
    configVersion: 'factory-config-v1',
    boards,
    incidentioRules: resolveIncidentioRules(overrides),
  });
  return { project, service, workItems: seeded.workItems };
}

describe('IncidentioRules', () => {
  it.each([
    { name: 'the bound custom board initial phase', sourceId: 'src-1', board: 'release', stage: 'queued' },
    { name: 'Work Intake when the source is unbound', sourceId: 'src-2', board: 'work', stage: 'intake' },
    {
      name: 'Work Intake when the bound board is not installed',
      sourceId: 'src-3',
      board: 'work',
      stage: 'intake',
    },
  ])('routes an observed follow-up to $name', async ({ sourceId, board, stage }) => {
    const { project, service, workItems } = await setup(
      undefined,
      createBoardRegistry({ boards: [createTestBoard()] }),
    );
    await service.ingest({
      orgId: 'org-1',
      userId: 'user-1',
      factoryProjectId: project.id,
      issues: [{ ...issue, sourceId }],
      intakeBoards: { 'src-1': 'release', 'src-3': 'hotfix' },
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
          source: 'incidentio-follow-up',
          sourceKey: issue.id,
          title: issue.title,
          url: issue.url,
          metadata: {
            identifier: 'INC-42',
            issueRef: issue.id,
            state: 'outstanding',
            stateType: 'unstarted',
            priority: 'Urgent',
            incident: 'INC-42',
            assignee: 'Grace Hopper',
            assignees: ['Grace Hopper'],
            creator: 'Ada Lovelace',
            author: 'Ada Lovelace',
            labels: ['reliability'],
          },
        },
      },
    ]);
  });

  it('files the same follow-up in a second project while the first still holds a live card', async () => {
    const { project, service, workItems } = await setup();
    await workItems.upsert({
      orgId: 'org-1',
      userId: 'user-1',
      factoryProjectId: 'other-factory',
      input: {
        externalSource: {
          integrationId: 'incidentio',
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
    ).resolves.toEqual({ status: 'committed', ingested: 1 });

    expect(await workItems.listDeferredDecisions('org-1', project.id)).toMatchObject([
      { decision: { type: 'upsertLinkedWorkItem', sourceKey: issue.id } },
    ]);
  });

  it('ingests a follow-up again once the other Factory finished its card', async () => {
    const { project, service, workItems } = await setup();
    await workItems.upsert({
      orgId: 'org-1',
      userId: 'user-1',
      factoryProjectId: 'other-factory',
      input: {
        externalSource: {
          integrationId: 'incidentio',
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
    const [entry] = await workItems.listDeferredDecisions('org-1', project.id);
    expect(entry?.decision).not.toHaveProperty('claimKey');
  });

  it.each(['completed', 'canceled'])(
    'closes linked follow-ups in state %s with shared audit metadata',
    async stateType => {
      const { project, service, workItems } = await setup();
      await workItems.upsert({
        orgId: 'org-1',
        userId: 'user-1',
        factoryProjectId: project.id,
        input: {
          title: issue.title,
          stages: ['planning'],
          sessions: {},
          externalSource: { integrationId: 'incidentio', type: 'issue', externalId: issue.id, url: issue.url },
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
          ingress: {
            identity: `incidentio:${issue.id}:${issue.updatedAt}`,
            // Closures must be stored under the close trigger, not the
            // observation trigger, so trigger-based audit queries stay correct.
            triggerType: 'incidentio.followUpClosed',
          },
        }),
      );
      expect(await workItems.listDeferredDecisions('org-1', project.id)).toMatchObject([
        { decision: { type: 'transition', stage: stateType === 'completed' ? 'done' : 'canceled' } },
      ]);
    },
  );

  it.each(['completed', 'canceled'])(
    'does not invoke overrides or create intake for unlinked %s follow-ups',
    async stateType => {
      const handler = vi.fn();
      const { project, service, workItems } = await setup({ followUpClosed: handler });
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
    const { project, service, workItems } = await setup({ followUpObserved: null });
    const input = { orgId: 'org-1', userId: 'user-1', factoryProjectId: project.id, issues: [issue] };
    await expect(service.ingest(input)).resolves.toEqual({ status: 'committed', ingested: 1 });
    expect(await workItems.listDeferredDecisions('org-1', project.id)).toEqual([]);
    // Replaying the same ingress is idempotent — nothing new is committed.
    await expect(service.ingest(input)).resolves.toEqual({ status: 'replayed', ingested: 1 });
  });

  it('reports missing when the Factory project does not exist', async () => {
    const { service } = await setup();
    await expect(
      service.ingest({
        orgId: 'org-1',
        userId: 'user-1',
        factoryProjectId: '00000000-0000-4000-8000-000000000000',
        issues: [issue],
      }),
    ).resolves.toEqual({ status: 'missing', ingested: 0 });
  });

  it('rejects an uninstalled linked target before accepting effects', async () => {
    const { project, service, workItems } = await setup(
      {
        followUpObserved: () => ({
          type: 'upsertLinkedWorkItem',
          idempotencyKey: 'invalid-target',
          board: 'missing',
          stage: 'shipping',
          source: 'incidentio-follow-up',
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

describe('incident.io board events', () => {
  it('reports a first sighting as created and a completed or canceled incident.io follow-up as closed for that reason', async () => {
    const seen: Array<{ event: string; boardEvent: unknown }> = [];
    const record = (context: FactoryIncidentioRuleContext) => {
      seen.push({ event: context.event, boardEvent: context.boardEvent });
    };
    const { project, service, workItems } = await setup({ followUpObserved: record, followUpClosed: record });
    const ingest = (stateType: string, updatedAt: string) =>
      service.ingest({
        orgId: 'org-1',
        userId: 'user-1',
        factoryProjectId: project.id,
        issues: [{ ...issue, stateType, updatedAt }],
      });
    await ingest('unstarted', '2026-07-02T00:00:00Z');
    await workItems.upsert({
      orgId: 'org-1',
      userId: 'user-1',
      factoryProjectId: project.id,
      input: {
        externalSource: { integrationId: 'incidentio', type: 'issue', externalId: issue.id, url: issue.url },
        title: issue.title,
        stages: ['planning'],
        sessions: {},
        metadata: {},
      },
    });
    await ingest('started', '2026-07-03T00:00:00Z');
    await ingest('completed', '2026-07-04T00:00:00Z');
    await ingest('canceled', '2026-07-05T00:00:00Z');

    expect(seen).toEqual([
      { event: 'followUpObserved', boardEvent: { type: 'work_item.created' } },
      // A later sighting of an open incident.io follow-up is not a status change.
      { event: 'followUpObserved', boardEvent: undefined },
      { event: 'followUpClosed', boardEvent: { type: 'work_item.closed', reason: 'completed' } },
      { event: 'followUpClosed', boardEvent: { type: 'work_item.closed', reason: 'canceled' } },
    ]);
  });
});
