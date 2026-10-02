import { workItemPhaseSemantics } from '../../boards/index.js';
import type { Intake, IntakeIssue } from '../../capabilities/intake.js';
import type { IntegrationContext } from '../base.js';
import { createIssueReconciler } from '../issue-reconciler.js';
import type { IssueReconciler } from '../issue-reconciler.js';
import type { IncidentioEventRules } from './default-rules.js';
import { IncidentioRules } from './rules.js';
import type { IncidentioIssueIngress } from './rules.js';

export type IncidentioIssueReconciler = IssueReconciler;

function issueToIngress(itemRef: string, issue: IntakeIssue): IncidentioIssueIngress {
  return {
    id: itemRef,
    identifier: issue.identifier,
    title: issue.title,
    url: issue.url,
    state: issue.state ?? '',
    stateType: issue.stateType ?? '',
    priorityLabel: issue.priority ?? '',
    assignee: issue.assignee ?? null,
    author: issue.author ?? null,
    incident: null,
    labels: [...(issue.labels ?? [])],
    createdAt: issue.createdAt,
    updatedAt: issue.updatedAt,
  };
}

export function attachIncidentioIssueReconciler(
  incidentio: { intake: Intake; rules: IncidentioEventRules },
  context: IntegrationContext,
): IncidentioIssueReconciler | undefined {
  if (!context.runtime || !incidentio.intake.resolveIntakeDispatch) return undefined;
  const boards = context.runtime.boards;

  const rules = new IncidentioRules({
    projects: context.storage.projects,
    storage: context.runtime.workItems,
    configVersion: context.runtime.configVersion,
    boards,
    incidentioRules: incidentio.rules,
  });

  return createIssueReconciler({
    integrationId: 'incidentio',
    intake: incidentio.intake,
    projects: context.storage.projects,
    storage: context.runtime.workItems,
    isTerminal: item => workItemPhaseSemantics(boards, item)?.kind === 'terminal',
    issueId: item => item.externalSource?.externalId,
    metadata: (item, issue) => ({
      identifier: issue.identifier,
      issueRef: item.externalSource?.externalId ?? issue.id,
      autoStartCandidate: issue.stateType === 'unstarted' || issue.stateType === 'started',
      incidentioItemType: issue.source === 'Follow-up' ? 'follow-up' : 'incident',
      incidentioState: issue.state,
      incidentioStateType: issue.stateType,
      incidentioPriority: issue.priority,
      incidentioAssignee: issue.assignee,
      incidentioDescription: 'description' in issue && typeof issue.description === 'string' ? issue.description : null,
      state: issue.state,
      stateType: issue.stateType,
      priority: issue.priority,
      source: issue.source,
      assignee: issue.assignee,
      assignees: issue.assignees ?? [],
      creator: issue.author,
      author: issue.author,
      labels: issue.labels ?? [],
      createdAt: issue.createdAt,
      updatedAt: issue.updatedAt,
    }),
    onClosed: async (item, issue, project) => {
      await rules.ingest({
        orgId: project.orgId,
        userId: 'factory-rule-dispatcher',
        factoryProjectId: project.id,
        issues: [issueToIngress(item.externalSource?.externalId ?? issue.id, issue)],
      });
    },
  });
}
