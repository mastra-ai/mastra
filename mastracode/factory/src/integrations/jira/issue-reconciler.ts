import { workItemPhaseSemantics } from '../../boards/index.js';
import type { Intake } from '../../capabilities/intake.js';
import type { IntegrationContext } from '../base.js';
import { createIssueReconciler } from '../issue-reconciler.js';
import type { IssueReconciler } from '../issue-reconciler.js';

export type JiraIssueReconciler = IssueReconciler;

export function attachJiraIssueReconciler(
  jira: { intake: Intake },
  context: IntegrationContext,
): JiraIssueReconciler | undefined {
  if (!context.runtime || !jira.intake.resolveIntakeDispatch) return undefined;
  const boards = context.runtime.boards;

  return createIssueReconciler({
    integrationId: 'jira',
    intake: jira.intake,
    projects: context.storage.projects,
    storage: context.runtime.workItems,
    isTerminal: item => workItemPhaseSemantics(boards, item)?.kind === 'terminal',
    issueId: item => item.externalSource?.externalId,
    metadata: (item, issue) => ({
      identifier: issue.identifier,
      issueRef: item.externalSource?.externalId ?? issue.id,
      autoStartCandidate: issue.stateType === 'unstarted' || issue.stateType === 'started',
      state: issue.state,
      stateType: issue.stateType,
      priority: issue.priority,
      project: issue.source,
      assignee: issue.assignee,
      assignees: issue.assignees ?? [],
      creator: issue.author,
      author: issue.author,
      labels: issue.labels ?? [],
      createdAt: issue.createdAt,
      updatedAt: issue.updatedAt,
    }),
  });
}
