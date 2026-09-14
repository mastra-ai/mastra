import { workItemPhaseSemantics } from '../../boards/index.js';
import type { Intake } from '../../capabilities/intake.js';
import type { IntegrationContext } from '../base.js';
import { createIssueReconciler } from '../issue-reconciler.js';
import type { IssueReconciler } from '../issue-reconciler.js';

export type IncidentioIssueReconciler = IssueReconciler;

export function attachIncidentioIssueReconciler(
  incidentio: { intake: Intake },
  context: IntegrationContext,
): IncidentioIssueReconciler | undefined {
  if (!context.runtime || !incidentio.intake.resolveIntakeDispatch) return undefined;
  const boards = context.runtime.boards;

  return createIssueReconciler({
    integrationId: 'incidentio',
    intake: incidentio.intake,
    projects: context.storage.projects,
    storage: context.runtime.workItems,
    isTerminal: item => workItemPhaseSemantics(boards, item)?.kind === 'terminal',
    issueId: item => item.externalSource?.externalId,
    metadata: (_item, issue) => ({
      identifier: issue.identifier,
      autoStartCandidate: issue.stateType === 'unstarted' || issue.stateType === 'started',
      incidentioItemType: issue.source === 'Follow-up' ? 'follow-up' : 'incident',
      incidentioState: issue.state,
      incidentioStateType: issue.stateType,
      incidentioPriority: issue.priority,
      incidentioAssignee: issue.assignee,
      incidentioDescription: 'description' in issue && typeof issue.description === 'string' ? issue.description : null,
      stateType: issue.stateType,
      priority: issue.priority,
      source: issue.source,
      assignee: issue.assignee,
      assignees: issue.assignees ?? [],
      creator: issue.author,
      author: issue.author,
      labels: issue.labels ?? [],
      updatedAt: issue.updatedAt,
    }),
  });
}
