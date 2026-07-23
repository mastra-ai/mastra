import { describe, expect, it } from 'vitest';
import { createFactoryStorageForTests } from '../storage/test-utils.js';
import { builtInFactoryRules } from './defaults.js';
import { FactoryLinearIssueService } from './linear-service.js';

const issue = {
  id: 'issue-1',
  sourceId: 'project-1',
  identifier: 'ENG-42',
  title: 'Fix intake sync',
  url: 'https://linear.app/acme/issue/ENG-42',
  state: 'Todo',
  stateType: 'unstarted',
  priorityLabel: 'High',
  assignee: 'ada',
  team: 'ENG',
  labels: ['bug'],
  createdAt: '2026-07-01T00:00:00Z',
  updatedAt: '2026-07-02T00:00:00Z',
};

async function setup() {
  const seeded = await createFactoryStorageForTests();
  const project = await seeded.projects.create({
    orgId: 'org-1',
    userId: 'user-1',
    input: { name: 'acme/repo' },
  });
  const service = new FactoryLinearIssueService({
    projects: seeded.projects,
    storage: seeded.workItems,
    rules: builtInFactoryRules(),
  });
  return { project, service, workItems: seeded.workItems };
}

describe('FactoryLinearIssueService', () => {
  it('commits one triage decision and replays an unchanged observation', async () => {
    const { project, service, workItems } = await setup();
    const input = { orgId: 'org-1', factoryProjectId: project.id, userId: 'user-1', issues: [issue] };

    await expect(service.ingest(input)).resolves.toEqual({ status: 'committed', ingested: 1 });
    await expect(service.ingest(input)).resolves.toEqual({ status: 'replayed', ingested: 1 });

    const decisions = await workItems.listDeferredDecisions('org-1', project.id);
    expect(decisions).toHaveLength(1);
    expect(decisions[0]).toMatchObject({
      actor: { type: 'human', id: 'user-1' },
      decision: {
        type: 'upsertLinkedWorkItem',
        source: 'linear-issue',
        sourceId: 'project-1',
        sourceKey: 'linear:project-1:issue-1',
        stage: 'triage',
      },
    });
  });

  it('keeps duplicate human identifiers distinct across Linear sources', async () => {
    const { project, service, workItems } = await setup();

    await expect(
      service.ingest({
        orgId: 'org-1',
        factoryProjectId: project.id,
        userId: 'user-1',
        issues: [issue, { ...issue, id: 'issue-2', sourceId: 'project-2', title: 'Fix another intake sync' }],
      }),
    ).resolves.toEqual({ status: 'committed', ingested: 2 });

    const decisions = await workItems.listDeferredDecisions('org-1', project.id);
    expect(decisions.map(record => record.decision)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sourceId: 'project-1', sourceKey: 'linear:project-1:issue-1' }),
        expect.objectContaining({ sourceId: 'project-2', sourceKey: 'linear:project-2:issue-2' }),
      ]),
    );
  });

  it('fails closed when the active Factory project belongs to another organization', async () => {
    const { project, service, workItems } = await setup();

    await expect(
      service.ingest({
        orgId: 'org-2',
        factoryProjectId: project.id,
        userId: 'user-2',
        issues: [issue],
      }),
    ).resolves.toEqual({ status: 'missing', ingested: 0 });
    await expect(workItems.listDeferredDecisions('org-2', project.id)).resolves.toEqual([]);
  });

  it('commits a new observation when Linear reports a later update', async () => {
    const { project, service, workItems } = await setup();
    const input = { orgId: 'org-1', factoryProjectId: project.id, userId: 'user-1', issues: [issue] };

    await service.ingest(input);
    await expect(
      service.ingest({
        ...input,
        issues: [{ ...issue, state: 'In Progress', updatedAt: '2026-07-03T00:00:00Z' }],
      }),
    ).resolves.toEqual({ status: 'committed', ingested: 1 });

    const decisions = await workItems.listDeferredDecisions('org-1', project.id);
    expect(decisions).toHaveLength(2);
  });
});
