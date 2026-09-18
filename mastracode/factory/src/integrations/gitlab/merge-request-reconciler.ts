import { workItemPhaseSemantics } from '../../boards/index.js';
import type { PullRequest } from '../../capabilities/version-control.js';
import type { FactoryProject } from '../../storage/domains/projects/base.js';
import type { WorkItemRow } from '../../storage/domains/work-items/base.js';
import type { IntegrationContext } from '../base.js';
import type { IssueReconcileSummary } from '../issue-reconciler.js';
import { gitlabConnection, GITLAB_TRUSTED_ACCESS_LEVEL } from './integration.js';
import type { GitLabIntegrationBase } from './integration.js';
import { attachGitLabRules } from './rules.js';
import type { ParsedGitLabWebhook } from './webhook.js';

function stringMetadata(item: WorkItemRow, key: string): string | undefined {
  const value = item.metadata?.[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function numberMetadata(item: WorkItemRow, key: string): number | undefined {
  const value = item.metadata?.[key];
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : undefined;
}

function projectPathFromUrl(url: string, host: string, mergeRequestIid: number): string | undefined {
  try {
    const parsed = new URL(url);
    if (parsed.host.toLowerCase() !== host.toLowerCase()) return undefined;
    const suffix = `/-/merge_requests/${mergeRequestIid}`;
    if (!parsed.pathname.endsWith(suffix)) return undefined;
    return decodeURIComponent(parsed.pathname.slice(1, -suffix.length));
  } catch {
    return undefined;
  }
}

function terminalEvent(item: WorkItemRow, pullRequest: PullRequest): ParsedGitLabWebhook {
  const projectId = numberMetadata(item, 'gitlabProjectId');
  const mergeRequestIid = numberMetadata(item, 'gitlabMergeRequestIid');
  const host = stringMetadata(item, 'gitlabHost');
  const projectPath =
    projectId && mergeRequestIid && host && item.externalSource?.url
      ? projectPathFromUrl(item.externalSource.url, host, mergeRequestIid)
      : undefined;
  if (!projectId || !mergeRequestIid || !host || !projectPath) {
    throw new Error('GitLab merge-request work item is missing canonical reconciliation metadata.');
  }
  const action = pullRequest.merged ? 'merge' : 'close';
  const username = pullRequest.author?.trim() || 'factory-reconciler';
  return {
    event: 'Merge Request Hook',
    deliveryId: `reconcile:merge-request:${projectId}:${mergeRequestIid}:${pullRequest.updatedAt}:${action}`,
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
        iid: mergeRequestIid,
        action,
        state: pullRequest.merged ? 'merged' : 'closed',
        title: pullRequest.title,
        url: pullRequest.url,
        created_at: pullRequest.createdAt,
        updated_at: pullRequest.updatedAt,
        source_branch: pullRequest.headBranch,
        target_branch: pullRequest.baseBranch,
        draft: pullRequest.draft,
        author: { username },
        assignees: (pullRequest.assignees ?? []).map(username => ({ username })),
        reviewers: (pullRequest.requestedReviewers ?? []).map(username => ({ username })),
        labels: pullRequest.labels ?? [],
      },
    },
  };
}

async function connectionForItem(
  context: IntegrationContext,
  project: FactoryProject,
  projectId: string,
  host: string,
): Promise<string | undefined> {
  const keys = (await context.storage.sourceControl.projectRepositories.listConfiguredExternalKeys()).filter(
    key => key.repositoryExternalId === projectId,
  );
  for (const key of keys.sort((left, right) => {
    const directOrder = Number(right.installationExternalId === 'direct') - Number(left.installationExternalId === 'direct');
    return directOrder || left.installationExternalId.localeCompare(right.installationExternalId);
  })) {
    const targets = await context.storage.sourceControl.projectRepositories.listByExternalRepository(key);
    if (!targets.some(target => target.orgId === project.orgId && target.factoryProjectId === project.id)) continue;
    const installation = await context.storage.sourceControl.installations.findByExternalId({
      orgId: project.orgId,
      externalId: key.installationExternalId,
    });
    const installationHost = installation?.providerMetadata.host;
    if (
      typeof installationHost === 'string' &&
      installationHost.trim().toLowerCase().replace(/\.$/, '') === host.trim().toLowerCase().replace(/\.$/, '')
    ) {
      return key.installationExternalId;
    }
  }
  return undefined;
}

export type GitLabMergeRequestReconciler = () => Promise<IssueReconcileSummary>;

export function attachGitLabMergeRequestReconciler(
  gitlab: Pick<GitLabIntegrationBase, 'versionControl' | 'rules' | 'getProjectMemberAccessLevel'>,
  context: IntegrationContext,
): GitLabMergeRequestReconciler | undefined {
  if (!context.runtime) return undefined;
  const ingest = attachGitLabRules(gitlab, context);
  if (!ingest) return undefined;
  const boards = context.runtime.boards;

  return async () => {
    const summary: IssueReconcileSummary = {
      projects: 0,
      checked: 0,
      updated: 0,
      closed: 0,
      missing: 0,
      failed: 0,
      errors: [],
    };
    for (const project of await context.storage.projects.listAll()) {
      const items = (
        await context.runtime!.workItems.list({ orgId: project.orgId, factoryProjectId: project.id })
      ).filter(
        item =>
          item.externalSource?.integrationId === 'gitlab' &&
          item.externalSource.type === 'pull-request' &&
          workItemPhaseSemantics(boards, item)?.kind !== 'terminal',
      );
      if (items.length === 0) continue;
      summary.projects += 1;
      for (const item of items) {
        summary.checked += 1;
        try {
          const projectId = numberMetadata(item, 'gitlabProjectId');
          const mergeRequestIid = numberMetadata(item, 'gitlabMergeRequestIid');
          const host = stringMetadata(item, 'gitlabHost');
          if (!projectId || !mergeRequestIid || !host) {
            summary.missing += 1;
            continue;
          }
          const connectionId = await connectionForItem(context, project, String(projectId), host);
          if (!connectionId) {
            summary.missing += 1;
            continue;
          }
          const pullRequest = await gitlab.versionControl.getPullRequest({
            connection: gitlabConnection(connectionId),
            sourceId: String(projectId),
            pullRequestId: String(mergeRequestIid),
          });
          if (!pullRequest) {
            summary.missing += 1;
            continue;
          }
          const current = item.metadata ?? {};
          let authorTrusted: boolean | undefined;
          if (pullRequest.author) {
            try {
              const accessLevel = await gitlab.getProjectMemberAccessLevel(
                connectionId,
                String(projectId),
                pullRequest.author,
              );
              authorTrusted = (accessLevel ?? 0) >= GITLAB_TRUSTED_ACCESS_LEVEL;
            } catch (error) {
              summary.failed += 1;
              summary.errors.push({
                projectId: project.id,
                workItemId: item.id,
                error: `Unable to refresh GitLab author trust: ${error instanceof Error ? error.message : String(error)}`,
              });
            }
          }
          const desired = {
            state: pullRequest.state,
            draft: pullRequest.draft,
            merged: pullRequest.merged,
            assignees: pullRequest.assignees ?? [],
            requestedReviewers: pullRequest.requestedReviewers ?? [],
            labels: pullRequest.labels ?? [],
            headBranch: pullRequest.headBranch,
            baseBranch: pullRequest.baseBranch,
            ...(pullRequest.author ? { author: pullRequest.author } : {}),
            ...(authorTrusted !== undefined ? { authorTrusted } : {}),
            updatedAt: pullRequest.updatedAt,
          };
          const metadataChanged = !Object.entries(desired).every(
            ([key, value]) => JSON.stringify(current[key]) === JSON.stringify(value),
          );
          if (pullRequest.state === 'closed') {
            const terminalTransition = current.state !== 'closed' || current.merged !== pullRequest.merged;
            if (terminalTransition) {
              await ingest(terminalEvent(item, pullRequest));
            }
            if (metadataChanged) {
              await context.runtime!.workItems.update({
                orgId: project.orgId,
                id: item.id,
                userId: 'factory-rule-dispatcher',
                patch: { metadata: { ...current, ...desired } },
              });
              summary.updated += 1;
            }
            summary.closed += 1;
            continue;
          }
          if (!metadataChanged) continue;
          await context.runtime!.workItems.update({
            orgId: project.orgId,
            id: item.id,
            userId: 'factory-rule-dispatcher',
            patch: { metadata: { ...current, ...desired } },
          });
          summary.updated += 1;
        } catch (error) {
          summary.failed += 1;
          summary.errors.push({
            projectId: project.id,
            workItemId: item.id,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }
    return summary;
  };
}
