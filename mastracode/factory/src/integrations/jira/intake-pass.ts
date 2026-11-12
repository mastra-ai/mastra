import type { IntakeIssue } from '../../capabilities/intake.js';
import { bindingLabelSlice } from '../../storage/domains/intake/base.js';
import type { IntegrationContext } from '../base.js';
import { boundIntakeSources, createIntakePass } from '../intake-pass.js';
import type { IntakePass, IntakeRecord } from '../intake-pass.js';
import type { JiraEventRules } from './default-rules.js';
import type { JiraIntakeScope } from './intake-jql.js';
import { attachJiraRules } from './rules.js';
import type { JiraIssueIngress } from './rules.js';

/** A listed issue under the reference its card is filed with; the Platform encodes its own. */
export function jiraIssueIngress(
  id: string,
  issue: IntakeIssue & { sourceId: string },
  site: string | null,
): JiraIssueIngress & { sourceId: string } {
  return {
    id,
    identifier: issue.identifier,
    title: issue.title,
    url: issue.url,
    state: issue.state ?? '',
    stateType: issue.stateType ?? '',
    priorityLabel: issue.priority ?? '',
    assignee: issue.assignee ?? null,
    author: issue.author ?? null,
    project: issue.source ?? null,
    site,
    labels: [...(issue.labels ?? [])],
    createdAt: issue.createdAt,
    updatedAt: issue.updatedAt,
    sourceId: issue.sourceId,
  };
}

/** The issue as Intake offers it: the facts its card would carry, so filing changes none of them. */
export function jiraIntakeRecord(issue: JiraIssueIngress): IntakeRecord {
  const created = new Date(issue.createdAt);
  return {
    source: { integrationId: 'jira', type: 'issue', externalId: issue.id, url: issue.url },
    title: issue.title,
    metadata: {
      identifier: issue.identifier,
      issueRef: issue.id,
      sourceCreatedAt: issue.createdAt,
      state: issue.state,
      stateType: issue.stateType,
      priority: issue.priorityLabel,
      project: issue.project,
      site: issue.site,
      assignee: issue.assignee,
      assignees: issue.assignee ? [issue.assignee] : [],
      creator: issue.author,
      author: issue.author,
      labels: [...issue.labels],
      createdAt: issue.createdAt,
      updatedAt: issue.updatedAt,
    },
    createdAt: Number.isNaN(created.getTime()) ? null : created,
  };
}

export interface JiraIntakeLister {
  readonly rules: JiraEventRules;
  /** One page of the active issues of the given scopes, each under its card reference. */
  listIntakeIssues(
    cursor: string | undefined,
    scopes: JiraIntakeScope[],
  ): Promise<{ issues: Array<JiraIssueIngress & { sourceId: string }>; nextCursor: string | null }>;
}

/**
 * Keeps the Jira candidates of every project. Jira sends the server no events, so this pass is
 * where a new issue is first seen.
 */
export function attachJiraIntakePass(jira: JiraIntakeLister, context: IntegrationContext): IntakePass | undefined {
  const ingest = attachJiraRules(jira, context);
  if (!context.runtime || !ingest) return undefined;
  return createIntakePass<JiraIssueIngress & { sourceId: string }>({
    integrationId: 'jira',
    kind: 'issue',
    projects: context.storage.projects,
    storage: context.runtime.workItems,
    status: context.storage.generic.settings,
    offersNewlyListed: true,
    open: async orgId => {
      const bound = await boundIntakeSources(context.storage.intake, orgId, 'jira');
      return {
        sources: bound.forProject,
        list: (factoryProjectId, sourceIds, cursor) => {
          // Each binding takes its label slice of the Jira project, as the board's list does.
          const scopes = sourceIds.flatMap(sourceId => {
            const siblings = bound.bindings.filter(binding => binding.sourceId === sourceId);
            const binding = siblings.find(candidate => candidate.factoryProjectId === factoryProjectId);
            return binding ? [{ projectId: sourceId, ...bindingLabelSlice(binding, siblings) }] : [];
          });
          return jira
            .listIntakeIssues(cursor, scopes)
            .then(page => ({ items: page.issues, nextCursor: page.nextCursor }));
        },
      };
    },
    record: jiraIntakeRecord,
    sourceId: issue => issue.sourceId,
    offer: ({ orgId, factoryProjectId }, issues) =>
      ingest({ orgId, userId: 'factory-rule-dispatcher', factoryProjectId, issues }),
  });
}
