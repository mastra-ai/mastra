import type { SourceControlStorageHandle } from '../../storage/domains/source-control/base.js';
import type { WorkItemRow } from '../../storage/domains/work-items/base.js';
import type { GithubIntegration } from './integration.js';

export const NEEDS_APPROVAL_LABEL = 'status: needs approval';

export interface ReconcileAcceptanceLabelsInput {
  orgId: string;
  factoryProjectId: string;
  item: WorkItemRow;
}

/**
 * Reflect a maintainer's acceptance of a triaged GitHub issue back on the
 * issue: the triage skill stamps `status: needs approval` and never removes it,
 * so the approval gesture on the board is the only point that can clear it.
 * Best-effort — every failure is a warning, never a rejected transition.
 */
export async function reconcileGithubAcceptanceLabels(
  github: GithubIntegration,
  sourceControl: SourceControlStorageHandle,
  input: ReconcileAcceptanceLabelsInput,
): Promise<void> {
  const { item } = input;
  if (item.externalSource?.integrationId !== 'github' || item.externalSource.type !== 'issue') return;
  const repositoryId = item.metadata?.githubRepositoryId;
  const issueNumber = item.metadata?.githubIssueNumber;
  if (typeof repositoryId !== 'number' || typeof issueNumber !== 'number' || issueNumber < 1) return;

  try {
    const target = await resolveRepository(sourceControl, input.orgId, input.factoryProjectId, repositoryId);
    if (!target) return;
    await github.removeIssueLabel(target.installationId, target.slug, issueNumber, NEEDS_APPROVAL_LABEL);
  } catch (error) {
    // GitHub answers 404 when the label is not on the issue; nothing to clear.
    if ((error as { status?: number }).status === 404) return;
    console.warn(`[factory] could not clear "${NEEDS_APPROVAL_LABEL}" for work item ${item.id}:`, error);
  }
}

async function resolveRepository(
  sourceControl: SourceControlStorageHandle,
  orgId: string,
  factoryProjectId: string,
  externalRepositoryId: number,
): Promise<{ installationId: number; slug: string } | undefined> {
  for (const connection of await sourceControl.connections.list({ orgId, factoryProjectId })) {
    const installation = await sourceControl.installations.get({ orgId, id: connection.installationId });
    if (!installation) continue;
    for (const link of await sourceControl.projectRepositories.list({ orgId, connectionId: connection.id })) {
      const repository = await sourceControl.repositories.get({ orgId, id: link.repositoryId });
      if (!repository || Number(repository.externalId) !== externalRepositoryId) continue;
      const installationId = Number(installation.externalId);
      if (!Number.isInteger(installationId)) return undefined;
      return { installationId, slug: repository.slug };
    }
  }
  return undefined;
}
