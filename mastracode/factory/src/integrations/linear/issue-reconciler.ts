import type { IntegrationContext } from '../base.js';
import { createIssueReconciler } from '../issue-reconciler.js';
import type { IssueReconciler } from '../issue-reconciler.js';
import type { LinearIntegration } from './integration.js';

export type LinearIssueReconciler = IssueReconciler;

export function attachLinearIssueReconciler(
  linear: Pick<LinearIntegration, 'intake'>,
  context: IntegrationContext,
): LinearIssueReconciler | undefined {
  if (!context.rules || !linear.intake.resolveIntakeDispatch) return undefined;
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
    }),
  });
}
