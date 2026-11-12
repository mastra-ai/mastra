import type { SourceControlStorageHandle } from '../../storage/domains/source-control/base.js';
import type { ExternalWorkItemSource, WorkItemsStorage } from '../../storage/domains/work-items/base.js';
import { encodeIssueReference } from './integration.js';
import type { ParsedGitLabWebhook } from './webhook.js';

/** The id a merge request's own card, and its candidate, is stored under. */
export function mergeRequestSourceKey(host: string, projectId: number, mergeRequestIid: number): string {
  return `gitlab-pr:${Buffer.from(JSON.stringify({ version: 1, host, projectId, mergeRequestIid }), 'utf8').toString('base64url')}`;
}

function object(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
}

/**
 * Stop offering an issue or merge request an event says is closed or merged. An open record is
 * stored by the next pass, which reads it the way the Intake column shows it.
 */
export async function settleGitLabIntakeEvent(
  deps: {
    storage: Pick<WorkItemsStorage, 'removeIntakeCandidate'>;
    sourceControl: Pick<SourceControlStorageHandle, 'projectRepositories'>;
  },
  parsed: ParsedGitLabWebhook,
): Promise<void> {
  const type = parsed.event === 'Issue Hook' ? 'issue' : parsed.event === 'Merge Request Hook' ? 'pull-request' : null;
  const attributes = object(parsed.payload.object_attributes);
  const projectId = object(parsed.payload.project)?.id;
  const iid = attributes?.iid;
  const host = parsed.instanceHost;
  if (!type || !host || typeof projectId !== 'number' || typeof iid !== 'number') return;
  const closed =
    attributes?.state === 'closed' ||
    attributes?.state === 'merged' ||
    attributes?.action === 'close' ||
    attributes?.action === 'merge' ||
    attributes?.draft === true;
  if (!closed) return;

  const source: ExternalWorkItemSource = {
    integrationId: 'gitlab',
    type,
    externalId:
      type === 'issue'
        ? encodeIssueReference({ host, projectId: String(projectId), issueIid: iid })
        : mergeRequestSourceKey(host, projectId, iid),
  };
  const repositoryExternalId = String(projectId);
  const keys = await deps.sourceControl.projectRepositories.listConfiguredExternalKeys();
  for (const key of keys.filter(key => key.repositoryExternalId === repositoryExternalId)) {
    const projects = await deps.sourceControl.projectRepositories.listByExternalRepository({
      installationExternalId: key.installationExternalId,
      repositoryExternalId,
    });
    for (const project of projects) {
      await deps.storage.removeIntakeCandidate({
        orgId: project.orgId,
        factoryProjectId: project.factoryProjectId,
        source,
      });
    }
  }
}
