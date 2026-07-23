import { describe, expect, it, vi } from 'vitest';
import { createFactoryStorageForTests } from '../storage/test-utils.js';
import { builtInFactoryRules, defaultFactoryRules } from './defaults.js';
import { FactoryLinearIssueService } from './linear-service.js';

const issue = {
  id: 'issue-1',
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

async function setup(rules = builtInFactoryRules()) {
  const seeded = await createFactoryStorageForTests();
  const project = await seeded.projects.create({
    orgId: 'org-1',
    userId: 'user-1',
    input: { name: 'acme/repo' },
  });
  const service = new FactoryLinearIssueService({
    projects: seeded.projects,
    storage: seeded.workItems,
    rules,
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
        sourceKey: 'linear:issue-1',
        stage: 'triage',
      },
    });
  });

  it('keeps distinct Linear issues with the same identifier separate', async () => {
    const { project, service, workItems } = await setup();

    await service.ingest({
      orgId: 'org-1',
      factoryProjectId: project.id,
      userId: 'user-1',
      issues: [
        issue,
        {
          ...issue,
          id: 'issue-2',
          url: 'https://linear.app/other/issue/ENG-42',
        },
      ],
    });

    const decisions = await workItems.listDeferredDecisions('org-1', project.id);
    expect(decisions.map(record => record.decision)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sourceKey: 'linear:issue-1' }),
        expect.objectContaining({ sourceKey: 'linear:issue-2' }),
      ]),
    );
  });

  it('recognizes legacy identifier-based source keys only for the same Linear issue', async () => {
    const seen = vi.fn(() => undefined);
    const rules = defaultFactoryRules({
      version: 'test-legacy-linear-source-key',
      overrides: { linear: { issueObserved: { onEvent: seen } } },
    });
    const { project, service, workItems } = await setup(rules);
    const legacy = await workItems.upsert({
      orgId: 'org-1',
      userId: 'user-1',
      factoryProjectId: project.id,
      input: {
        externalSource: {
          integrationId: 'linear',
          type: 'issue',
          externalId: 'linear:ENG-42',
          url: issue.url,
        },
        title: 'ENG-42: Fix intake sync',
        stages: ['triage'],
        sessions: {},
        metadata: { linearIssueId: issue.id, linearIssueIdentifier: issue.identifier },
      },
    });

    await service.ingest({
      orgId: 'org-1',
      factoryProjectId: project.id,
      userId: 'user-1',
      issues: [{ ...issue, identifier: 'OPS-42', url: 'https://linear.app/acme/issue/OPS-42' }],
    });

    expect(seen).toHaveBeenCalledWith(
      expect.objectContaining({ item: expect.objectContaining({ id: legacy.item.id }) }),
    );
  });

  it('does not match a legacy identifier key that belongs to another Linear issue', async () => {
    const seen = vi.fn(() => undefined);
    const rules = defaultFactoryRules({
      version: 'test-ambiguous-linear-source-key',
      overrides: { linear: { issueObserved: { onEvent: seen } } },
    });
    const { project, service, workItems } = await setup(rules);
    await workItems.upsert({
      orgId: 'org-1',
      userId: 'user-1',
      factoryProjectId: project.id,
      input: {
        externalSource: {
          integrationId: 'linear',
          type: 'issue',
          externalId: 'linear:ENG-42',
          url: 'https://linear.app/other/issue/ENG-42',
        },
        title: 'ENG-42: Another issue',
        stages: ['triage'],
        sessions: {},
        metadata: { linearIssueId: 'issue-other', linearIssueIdentifier: issue.identifier },
      },
    });

    await service.ingest({ orgId: 'org-1', factoryProjectId: project.id, userId: 'user-1', issues: [issue] });

    expect(seen).toHaveBeenCalledWith(expect.not.objectContaining({ item: expect.anything() }));
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
    expect(decisions.map(record => record.decision)).toEqual([
      expect.objectContaining({ sourceKey: 'linear:issue-1' }),
      expect.objectContaining({ sourceKey: 'linear:issue-1' }),
    ]);
  });
});
