import { workItemPhaseSemantics } from '../../boards/index.js';
import { toBoardSource } from '../../boards/project-boards.js';
import type { Intake, IntakeIssue } from '../../capabilities/intake.js';
import type { IntegrationContext } from '../base.js';
import { withIntakeDiscovery } from '../intake-discovery.js';
import { createIssueReconcileOne, createIssueReconciler } from '../issue-reconciler.js';
import type { IssueReconcileOne, IssueReconciler, IssueReconcilerOptions } from '../issue-reconciler.js';
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

function reconcilerOptions(
  incidentio: { intake: Intake; rules: IncidentioEventRules },
  context: IntegrationContext,
): { options: IssueReconcilerOptions; rules: IncidentioRules } | undefined {
  if (!context.runtime || !incidentio.intake.resolveIntakeDispatch) return undefined;
  const boards = context.runtime.boards;

  const rules = new IncidentioRules({
    projects: context.storage.projects,
    storage: context.runtime.workItems,
    configVersion: context.runtime.configVersion,
    boards,
    incidentioRules: incidentio.rules,
  });

  const options: IssueReconcilerOptions = {
    integrationId: 'incidentio',
    intake: incidentio.intake,
    projects: context.storage.projects,
    storage: context.runtime.workItems,
    ...(context.runtime.keptCards ? { cards: context.runtime.keptCards } : {}),
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
  };
  return { options, rules };
}

/**
 * One incident.io sweep: refresh carded items (metadata, closes), then list
 * what every project's board shows so follow-ups no event carded yet get
 * their card.
 */
export function attachIncidentioIssueReconciler(
  incidentio: { intake: Intake; rules: IncidentioEventRules; isFollowUpSource(sourceId: string): boolean },
  context: IntegrationContext,
): IncidentioIssueReconciler | undefined {
  const resolved = reconcilerOptions(incidentio, context);
  if (!resolved) return undefined;
  const { options, rules } = resolved;
  return withIntakeDiscovery(createIssueReconciler(options), {
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
      // A board shows follow-ups only, so incidents are never listed.
      return bound
        .filter(sourceId => incidentio.isFollowUpSource(sourceId))
        .map(sourceId => async (cursor: string | undefined) => {
          const page = await incidentio.intake.listItems({
            orgId: project.orgId,
            userId: 'factory-rule-dispatcher',
            sourceIds: [sourceId],
            ...(cursor ? { cursor } : {}),
          });
          return { issues: followUpIssues(page.items), nextCursor: page.nextCursor };
        });
    },
    // incident.io lists follow-ups oldest first and cannot sort or filter them by
    // status, so a page cap would never reach the newest ones.
    maxPages: Number.POSITIVE_INFINITY,
    ingest: input => rules.ingest(input),
  });
}

/** Reconciles just the cards an event names, through the same path as the full sweep. */
export function attachIncidentioIssueReconcileOne(
  incidentio: { intake: Intake; rules: IncidentioEventRules },
  context: IntegrationContext,
): IssueReconcileOne | undefined {
  const resolved = reconcilerOptions(incidentio, context);
  return resolved ? createIssueReconcileOne(resolved.options) : undefined;
}
