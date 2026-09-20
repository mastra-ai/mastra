import { workItemPhaseSemantics } from '../../boards/index.js';
import type { IntakeIssue } from '../../capabilities/intake.js';
import type { WorkItemRow } from '../../storage/domains/work-items/base.js';
import type { IntegrationContext } from '../base.js';
import { createIssueReconciler } from '../issue-reconciler.js';
import type { IssueReconciler } from '../issue-reconciler.js';
import type { GitLabIntegrationBase } from './integration.js';
import { attachGitLabRules } from './rules.js';
import type { ParsedGitLabWebhook } from './webhook.js';

export type GitLabIssueReconciler = IssueReconciler;

function stringMetadata(item: WorkItemRow, key: string): string | undefined {
  const value = item.metadata?.[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function numberMetadata(item: WorkItemRow, key: string): number | undefined {
  const value = item.metadata?.[key];
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : undefined;
}

function normalizeHost(host: string): string {
  return host.trim().toLowerCase().replace(/\.$/, '');
}

function closedIssueEvent(item: WorkItemRow, issue: IntakeIssue): ParsedGitLabWebhook {
  const projectId = numberMetadata(item, 'gitlabProjectId');
  const issueIid = numberMetadata(item, 'gitlabIssueIid');
  const host = stringMetadata(item, 'gitlabHost');
  const projectPath = issue.source?.trim();
  if (!projectId || !issueIid || !host || !projectPath) {
    throw new Error('GitLab issue work item is missing canonical reconciliation metadata.');
  }
  const username = issue.authorUsername?.trim() || 'factory-reconciler';
  return {
    event: 'Issue Hook',
    deliveryId: `reconcile:issue:${normalizeHost(host)}:${projectId}:${issueIid}:${issue.updatedAt}:closed`,
    instanceHost: host,
    payload: {
      user_username: username,
      user: { username },
      project: {
        id: projectId,
        path_with_namespace: projectPath,
        web_url: `https://${host}/${projectPath}`,
      },
      object_attributes: {
        iid: issueIid,
        title: issue.title,
        url: issue.url,
        state: 'closed',
        action: 'close',
        created_at: issue.createdAt,
        updated_at: issue.updatedAt,
        author: { username },
        assignees: (issue.assignees ?? []).map(username => ({ username })),
        labels: issue.labels,
      },
    },
  };
}

export function attachGitLabIssueReconciler(
  gitlab: Pick<
    GitLabIntegrationBase,
    'intake' | 'rules' | 'getProjectMemberAccessLevel' | 'getWorkItemAuthorUsername' | 'isProjectMemberTrustedForSource'
  >,
  context: IntegrationContext,
): GitLabIssueReconciler | undefined {
  if (!context.runtime || !gitlab.intake.resolveIntakeDispatch) return undefined;
  const ingest = attachGitLabRules(gitlab, context);
  if (!ingest) return undefined;
  const boards = context.runtime.boards;
  const reconciledMetadata = async (issue: IntakeIssue, sourceId: string) => ({
    identifier: issue.identifier,
    state: issue.state,
    stateType: issue.stateType,
    author: issue.author,
    authorTrusted: issue.authorUsername
      ? await gitlab.isProjectMemberTrustedForSource(sourceId, issue.authorUsername)
      : false,
    assignee: issue.assignee,
    assignees: issue.assignees ?? [],
    labels: issue.labels,
    labelColors: issue.labelColors ?? {},
    updatedAt: issue.updatedAt,
  });

  return createIssueReconciler({
    integrationId: 'gitlab',
    intake: gitlab.intake,
    projects: context.storage.projects,
    storage: context.runtime.workItems,
    isTerminal: item => workItemPhaseSemantics(boards, item)?.kind === 'terminal',
    issueId: item => {
      const issueIid = numberMetadata(item, 'gitlabIssueIid');
      return issueIid ? String(issueIid) : undefined;
    },
    metadata: (_item, issue, dispatch) => {
      if (!dispatch.sourceId) throw new Error('GitLab reconciliation did not resolve a source identity.');
      return reconciledMetadata(issue, dispatch.sourceId);
    },
    onClosed: async (item, issue, _project, dispatch) => {
      if (!dispatch.sourceId) throw new Error('GitLab reconciliation did not resolve a source identity.');
      await ingest(closedIssueEvent(item, issue));
      return reconciledMetadata(issue, dispatch.sourceId);
    },
  });
}
