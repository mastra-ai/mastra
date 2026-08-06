import { describe, expect, it, vi } from 'vitest';

import type { Intake, IntakeIssueDetail } from '../capabilities/intake.js';
import type { FactoryProject } from '../storage/domains/projects/base.js';
import type { WorkItemRow, WorkItemsStorage } from '../storage/domains/work-items/base.js';
import type { IntegrationContext } from './base.js';
import type { GithubIntegration } from './github/integration.js';
import { attachGithubIssueReconciler } from './github/issue-reconciler.js';
import type { LinearIntegration } from './linear/integration.js';
import { attachLinearIssueReconciler } from './linear/issue-reconciler.js';

const project: FactoryProject = {
  id: 'project-1',
  orgId: 'org-1',
  createdBy: 'user-1',
  name: 'Factory',
  description: null,
  defaultModelId: null,
  slackWorkItemsEnabled: false,
  createdAt: new Date('2026-08-01T00:00:00Z'),
  updatedAt: new Date('2026-08-01T00:00:00Z'),
};

function item(integrationId: 'github' | 'linear', metadata: Record<string, unknown>): WorkItemRow {
  return {
    id: `${integrationId}-item`,
    orgId: project.orgId,
    factoryProjectId: project.id,
    externalSource: {
      integrationId,
      type: 'issue',
      externalId: integrationId === 'github' ? 'github-issue:42' : 'linear:ENG-42',
      url: `https://example.com/${integrationId}/42`,
    },
    parentWorkItemId: null,
    title: 'Issue',
    stages: ['backlog'],
    stageHistory: [],
    sessions: {},
    metadata,
    revision: 1,
    createdBy: 'factory-rule-dispatcher',
    createdAt: new Date('2026-08-01T00:00:00Z'),
    updatedAt: new Date('2026-08-01T00:00:00Z'),
  };
}

function issue(overrides: Partial<IntakeIssueDetail> = {}): IntakeIssueDetail {
  return {
    id: '42',
    identifier: '#42',
    title: 'Issue',
    url: 'https://example.com/issues/42',
    author: 'octocat',
    state: 'open',
    stateType: 'open',
    priority: null,
    assignee: 'hubot',
    assignees: ['hubot', 'monalisa'],
    source: 'acme/app',
    labels: [],
    commentCount: 0,
    createdAt: '2026-08-01T00:00:00Z',
    updatedAt: '2026-08-02T00:00:00Z',
    description: null,
    comments: [],
    ...overrides,
  };
}

function context(workItem: WorkItemRow, intake: Intake) {
  const update = vi.fn(async () => workItem);
  return {
    context: {
      storage: { projects: { listAll: vi.fn(async () => [project]) } },
      rules: {
        workItems: {
          list: vi.fn(async () => [workItem]),
          update,
        } as unknown as WorkItemsStorage,
      },
    } as unknown as IntegrationContext,
    intake,
    update,
  };
}

describe('issue reconcilers', () => {
  it('reconciles GitHub issue author, state, assignees, and labels', async () => {
    const workItem = item('github', { githubRepositoryId: 101, githubIssueNumber: 42, assignees: ['old'] });
    const intake = {
      resolveIntakeDispatch: vi.fn(async () => ({
        connection: { type: 'github-app' as const, installationId: 7 },
        sourceId: 'acme/app',
        issueId: 'github-issue:42',
      })),
      getIssue: vi.fn(async () => issue({ labels: ['bug', 'p1'] })),
    } as unknown as Intake;
    const test = context(workItem, intake);
    const reconcile = attachGithubIssueReconciler({ intake } as Pick<GithubIntegration, 'intake'>, test.context);

    await expect(reconcile?.()).resolves.toMatchObject({ projects: 1, checked: 1, updated: 1, failed: 0 });
    expect(intake.resolveIntakeDispatch).toHaveBeenCalledWith({
      orgId: 'org-1',
      externalSource: { type: 'issue', externalId: '101:42' },
    });
    expect(intake.getIssue).toHaveBeenCalledWith(expect.objectContaining({ issueId: '42' }));
    expect(test.update).toHaveBeenCalledWith(
      expect.objectContaining({
        patch: {
          metadata: expect.objectContaining({
            githubRepositoryId: 101,
            githubIssueNumber: 42,
            state: 'open',
            author: 'octocat',
            assignees: ['hubot', 'monalisa'],
            labels: ['bug', 'p1'],
          }),
        },
      }),
    );
  });

  it('uses the persisted Linear issue UUID and refreshes teammate metadata', async () => {
    const workItem = item('linear', { linearIssueId: 'linear-uuid', identifier: 'ENG-42' });
    const intake = {
      resolveIntakeDispatch: vi.fn(async () => ({
        connection: { type: 'oauth' as const, accessToken: 'token' },
        issueId: 'linear:ENG-42',
      })),
      getIssue: vi.fn(async () =>
        issue({
          id: 'linear-uuid',
          identifier: 'ENG-42',
          author: 'Linear Ada',
          state: 'In Progress',
          stateType: 'started',
          priority: 'High',
          assignee: 'Linear Grace',
          assignees: undefined,
          source: 'ENG',
          labels: ['triage', 'ux'],
        }),
      ),
    } as unknown as Intake;
    const test = context(workItem, intake);
    const reconcile = attachLinearIssueReconciler({ intake } as Pick<LinearIntegration, 'intake'>, test.context);

    await expect(reconcile?.()).resolves.toMatchObject({ projects: 1, checked: 1, updated: 1, failed: 0 });
    expect(intake.getIssue).toHaveBeenCalledWith(expect.objectContaining({ issueId: 'linear-uuid' }));
    expect(test.update).toHaveBeenCalledWith(
      expect.objectContaining({
        patch: {
          metadata: expect.objectContaining({
            linearIssueId: 'linear-uuid',
            identifier: 'ENG-42',
            linearState: 'In Progress',
            linearStateType: 'started',
            linearPriority: 'High',
            linearAssignee: 'Linear Grace',
            linearCreator: 'Linear Ada',
            linearTeam: 'ENG',
            assignee: 'Linear Grace',
            creator: 'Linear Ada',
            author: 'Linear Ada',
            labels: ['triage', 'ux'],
          }),
        },
      }),
    );
  });

  it('does not write already reconciled metadata and isolates fetch failures', async () => {
    const current = item('github', {
      githubRepositoryId: 101,
      githubIssueNumber: 42,
      state: 'open',
      author: 'octocat',
      assignees: ['monalisa', 'hubot'],
    });
    const failed = { ...item('github', { githubIssueNumber: 43 }), id: 'failed-item' };
    const intake = {
      resolveIntakeDispatch: vi.fn(async () => ({
        connection: { type: 'github-app' as const, installationId: 7 },
        sourceId: 'acme/app',
        issueId: '42',
      })),
      getIssue: vi.fn(async ({ issueId }: { issueId: string }) => {
        if (issueId === '43') throw new Error('provider unavailable');
        return issue();
      }),
    } as unknown as Intake;
    const update = vi.fn();
    const ctx = {
      storage: { projects: { listAll: vi.fn(async () => [project]) } },
      rules: {
        workItems: {
          list: vi.fn(async () => [current, failed]),
          update,
        },
      },
    } as unknown as IntegrationContext;
    const reconcile = attachGithubIssueReconciler({ intake } as Pick<GithubIntegration, 'intake'>, ctx);

    await expect(reconcile?.()).resolves.toMatchObject({ checked: 2, updated: 0, failed: 1 });
    expect(update).not.toHaveBeenCalled();
  });
});
