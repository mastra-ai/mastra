import { workItemPhaseSemantics } from '../../boards/index.js';
import { toBoardSource } from '../../boards/project-boards.js';
import type { Intake, IntakeIssue } from '../../capabilities/intake.js';
import type { IntegrationContext } from '../base.js';
import { withIntakeDiscovery } from '../intake-discovery.js';
import { createIssueReconciler } from '../issue-reconciler.js';
import type { IssueReconciler } from '../issue-reconciler.js';
import { scopeJiraSourcesToProject } from './binding-scope.js';
import type { JiraEventRules } from './default-rules.js';
import type { JiraIntakeScope } from './intake-jql.js';
import { JiraRules } from './rules.js';
import type { JiraIssueIngress } from './rules.js';

export type JiraIssueReconciler = IssueReconciler;

function issueToIngress(issueRef: string, issue: IntakeIssue): JiraIssueIngress {
  return {
    id: issueRef,
    identifier: issue.identifier,
    title: issue.title,
    url: issue.url,
    state: issue.state ?? '',
    stateType: issue.stateType ?? '',
    priorityLabel: issue.priority ?? '',
    assignee: issue.assignee ?? null,
    author: issue.author ?? null,
    project: issue.source ?? null,
    site: null,
    labels: [...(issue.labels ?? [])],
    createdAt: issue.createdAt,
    updatedAt: issue.updatedAt,
  };
}

/** One page of what a board lists; `externalId` and `site` are set by the Platform integration only. */
type ListActiveIssues = (
  cursor: string | undefined,
  scopes: JiraIntakeScope[],
) => Promise<{ issues: Array<IntakeIssue & { externalId?: string; site?: string }>; nextCursor: string | null }>;

/**
 * One Jira sweep: refresh carded issues (metadata, closes), then list what
 * every project's board shows so issues nobody has carded yet get their card.
 * Jira sends Factory no events, so this is the only first-sight path.
 */
export function attachJiraIssueReconciler(
  jira: { intake: Intake; rules: JiraEventRules; listActiveIssues: ListActiveIssues },
  context: IntegrationContext,
): JiraIssueReconciler | undefined {
  if (!context.runtime || !jira.intake.resolveIntakeDispatch) return undefined;
  const boards = context.runtime.boards;

  const rules = new JiraRules({
    projects: context.storage.projects,
    storage: context.runtime.workItems,
    configVersion: context.runtime.configVersion,
    boards,
    jiraRules: jira.rules,
  });

  const reconcile = createIssueReconciler({
    integrationId: 'jira',
    intake: jira.intake,
    projects: context.storage.projects,
    storage: context.runtime.workItems,
    ...(context.runtime.keptCards ? { cards: context.runtime.keptCards } : {}),
    isTerminal: item => workItemPhaseSemantics(toBoardSource(boards).forProject(item), item)?.kind === 'terminal',
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
    integrationId: 'jira',
    intake: context.storage.intake,
    projects: context.storage.projects,
    open: async (project, selectedIds) => {
      const { scopes } = await scopeJiraSourcesToProject({
        intake: context.storage.intake,
        orgId: project.orgId,
        factoryProjectId: project.id,
        selectedIds,
      });
      return scopes.map(scope => async (cursor: string | undefined) => {
        const page = await jira.listActiveIssues(cursor, [scope]);
        return {
          issues: page.issues.map(issue => ({
            ...issueToIngress(issue.externalId ?? issue.id, issue),
            site: issue.site ?? null,
            sourceId: issue.sourceId,
          })),
          nextCursor: page.nextCursor,
        };
      });
    },
    ingest: input => rules.ingest(input),
  });
}
