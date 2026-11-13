import { workItemPhaseSemantics } from '../../boards/index.js';
import { toBoardSource } from '../../boards/project-boards.js';
import type { Intake, IntakeIssue } from '../../capabilities/intake.js';
import type { IntegrationContext } from '../base.js';
import { withIntakeDiscovery } from '../intake-discovery.js';
import { createIssueReconciler } from '../issue-reconciler.js';
import type { IssueReconciler } from '../issue-reconciler.js';
import type { IncidentioEventRules } from './default-rules.js';
import { followUpIssues, scopeSourceIdsToProject } from './routes.js';
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

/**
 * One incident.io sweep: refresh carded items (metadata, closes), then list
 * what every project's board shows so follow-ups nobody has carded yet get
 * their card. incident.io sends Factory no events, so this is the only
 * first-sight path.
 */
export function attachIncidentioIssueReconciler(
  incidentio: { intake: Intake; rules: IncidentioEventRules; isFollowUpSource(sourceId: string): boolean },
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

  const reconcile = createIssueReconciler({
    integrationId: 'incidentio',
    intake: incidentio.intake,
    projects: context.storage.projects,
    storage: context.runtime.workItems,
    isTerminal: item => workItemPhaseSemantics(toBoardSource(boards).forProject(item), item)?.kind === 'terminal',
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

  return withIntakeDiscovery(reconcile, {
    integrationId: 'incidentio',
    intake: context.storage.intake,
    projects: context.storage.projects,
    open: async (project, selectedIds) => {
      const bound = await scopeSourceIdsToProject({
        intake: context.storage.intake,
        orgId: project.orgId,
        factoryProjectId: project.id,
        selectedIds,
      });
      // A board shows follow-ups only, so the page budget is not spent on incidents.
      const sourceIds = bound.filter(sourceId => incidentio.isFollowUpSource(sourceId));
      if (sourceIds.length === 0) return null;
      return async cursor => {
        const page = await incidentio.intake.listItems({
          orgId: project.orgId,
          userId: 'factory-rule-dispatcher',
          sourceIds,
          ...(cursor ? { cursor } : {}),
        });
        return { issues: followUpIssues(page.items), nextCursor: page.nextCursor };
      };
    },
    ingest: input => rules.ingest(input),
  });
}
