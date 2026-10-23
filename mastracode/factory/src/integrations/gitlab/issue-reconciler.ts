import { workItemPhaseSemantics } from '../../boards/index.js';
import type { IntakeIssue } from '../../capabilities/intake.js';
import type { WorkItemRow } from '../../storage/domains/work-items/base.js';
import type { IntegrationContext } from '../base.js';
import { createIssueReconciler } from '../issue-reconciler.js';
import type { IssueReconciler } from '../issue-reconciler.js';
import { decodeIssueReference } from './integration.js';
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

function identityForItem(item: WorkItemRow): { projectId: number; issueIid: number; host: string } | null {
  const reference = decodeIssueReference(item.externalSource?.externalId ?? '');
  const projectId = Number(reference?.projectId);
  if (!reference || !Number.isSafeInteger(projectId) || projectId <= 0) return null;
  let urlHost: string;
  try {
    urlHost = new URL(item.externalSource?.url ?? '').host;
  } catch {
    return null;
  }
  const host = normalizeHost(reference.host ?? urlHost);
  if (!host || host !== normalizeHost(urlHost)) return null;
  const metadataProjectId = numberMetadata(item, 'gitlabProjectId');
  const metadataIssueIid = numberMetadata(item, 'gitlabIssueIid');
  const metadataHost = stringMetadata(item, 'gitlabHost');
  if (
    (metadataProjectId && metadataProjectId !== projectId) ||
    (metadataIssueIid && metadataIssueIid !== reference.issueIid) ||
    (metadataHost && normalizeHost(metadataHost) !== host)
  ) {
    return null;
  }
  return { projectId, issueIid: reference.issueIid, host };
}

function closedIssueEvent(
  issue: IntakeIssue,
  identity: { projectId: number; issueIid: number; host: string },
): ParsedGitLabWebhook {
  const { projectId, issueIid, host } = identity;
  const projectPath = issue.source?.trim();
  if (!projectPath) {
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
  const reconciledMetadata = async (item: WorkItemRow, issue: IntakeIssue, sourceId: string) => {
    const identity = identityForItem(item);
    return {
      ...(identity && {
        gitlabHost: identity.host,
        gitlabProjectId: identity.projectId,
        gitlabIssueIid: identity.issueIid,
      }),
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
    };
  };

  return createIssueReconciler({
    integrationId: 'gitlab',
    intake: gitlab.intake,
    projects: context.storage.projects,
    storage: context.runtime.workItems,
    isTerminal: item => workItemPhaseSemantics(boards, item)?.kind === 'terminal',
    issueId: item => {
      const issueIid = identityForItem(item)?.issueIid;
      return issueIid ? String(issueIid) : undefined;
    },
    metadata: (item, issue, dispatch) => {
      if (!dispatch.sourceId) throw new Error('GitLab reconciliation did not resolve a source identity.');
      return reconciledMetadata(item, issue, dispatch.sourceId);
    },
    onClosed: async (item, issue, _project, dispatch) => {
      if (!dispatch.sourceId) throw new Error('GitLab reconciliation did not resolve a source identity.');
      const identity = identityForItem(item);
      if (!identity) throw new Error('GitLab issue work item is missing canonical reconciliation metadata.');
      await ingest(closedIssueEvent(issue, identity));
      return reconciledMetadata(item, issue, dispatch.sourceId);
    },
  });
}
