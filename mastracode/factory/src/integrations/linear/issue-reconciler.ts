import type { IntegrationContext } from '../base.js';
import { createIssueReconciler } from '../issue-reconciler.js';
import type { IssueReconciler } from '../issue-reconciler.js';
import type { LinearIntegration } from './integration.js';
import { LinearRules } from './rules.js';
import type { LinearIssueIngress } from './rules.js';

export type LinearIssueReconciler = IssueReconciler;

function issueToIngress(issue: import('../../capabilities/intake.js').IntakeIssue): LinearIssueIngress {
  return {
    id: issue.id,
    identifier: issue.identifier,
    title: issue.title,
    url: issue.url,
    state: issue.state ?? '',
    stateType: issue.stateType ?? '',
    priorityLabel: issue.priority ?? '',
    assignee: issue.assignee ?? null,
    creator: issue.author ?? null,
    team: issue.source ?? null,
    labels: [...(issue.labels ?? [])],
    createdAt: issue.createdAt,
    updatedAt: issue.updatedAt,
  };
}

export function attachLinearIssueReconciler(
  linear: Pick<LinearIntegration, 'intake'>,
  context: IntegrationContext,
): LinearIssueReconciler | undefined {
  if (!context.rules || !linear.intake.resolveIntakeDispatch) return undefined;

  const rules = new LinearRules({
    projects: context.storage.projects,
    storage: context.rules.workItems,
    rules: context.rules.config,
  });

  return createIssueReconciler({
    integrationId: 'linear',
    intake: linear.intake,
    projects: context.storage.projects,
    storage: context.rules.workItems,
    issueId: item => {
      const issueId = item.metadata?.linearIssueId;
      return typeof issueId === 'string' && issueId.length > 0 ? issueId : undefined;
    },
    metadata: (_item, issue) => ({
      linearIssueId: issue.id,
      identifier: issue.identifier,
      linearState: issue.state,
      linearStateType: issue.stateType,
      linearPriority: issue.priority,
      linearAssignee: issue.assignee,
      linearCreator: issue.author,
      linearTeam: issue.source,
      assignee: issue.assignee,
      creator: issue.author,
      author: issue.author,
      labels: issue.labels ?? [],
    }),
    onClosed: async (item, issue, project) => {
      await rules.ingest({
        orgId: project.orgId,
        userId: 'factory-rule-dispatcher',
        factoryProjectId: project.id,
        issues: [issueToIngress(issue)],
      });
    },
  });
}
