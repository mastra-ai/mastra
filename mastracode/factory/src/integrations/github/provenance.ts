import type { FactoryRuleJsonValue } from '../../rules/types.js';
import type { IntegrationStorageHandle } from '../../storage/domains/integrations/base.js';
import type { SourceControlStorageHandle } from '../../storage/domains/source-control/base.js';
import type { FactoryRunBindingRecord, WorkItemRow } from '../../storage/domains/work-items/base.js';
import type { GithubIntegration } from './integration.js';
import { parseCreatedPullRequest } from './session-subscriptions.js';

export interface RecordFactoryPullRequestProvenanceInput {
  binding: FactoryRunBindingRecord;
  item: WorkItemRow;
  assistantMessageId: string;
  toolCallId: string;
  toolName: string;
  toolInput: FactoryRuleJsonValue;
  toolResult: FactoryRuleJsonValue;
  status: 'success' | 'error';
}

export interface FactoryPullRequestProvenanceData {
  kind: 'factory-pr-provenance';
  bindingId: string;
  workItemId: string;
  repositoryId: number;
  pullRequestNumber: number;
  pullRequestUrl: string;
  assistantMessageId: string;
  toolCallId: string;
  /**
   * Whether the PR was confirmed against the GitHub API at record time.
   * False means the verification fetch itself failed (e.g. a broken
   * installation token) — the record is still trustworthy for auto-linking
   * because it is only consumed when a real event for this exact
   * (repository, PR number) arrives, which proves the PR exists.
   * Absent on rows written before this field existed (treat as verified).
   */
  verified?: boolean;
}

export async function recordFactoryPullRequestProvenance(
  github: GithubIntegration,
  sourceControl: SourceControlStorageHandle,
  integrationStorage: IntegrationStorageHandle<
    Record<string, unknown>,
    Record<string, unknown>,
    FactoryPullRequestProvenanceData
  >,
  input: RecordFactoryPullRequestProvenanceInput,
): Promise<void> {
  if (input.status !== 'success' || input.item.externalSource?.type === 'pull-request') return;
  const url = parseCreatedPullRequest({
    toolName: input.toolName,
    input: input.toolInput,
    output: input.toolResult,
  });
  if (!url) return;

  try {
    const match = url.match(/^https:\/\/github\.com\/([^/]+\/[^/]+)\/pull\/(\d+)\/?$/i);
    if (!match) return;
    const repositorySlug = match[1]!;
    let repositoryId: number | undefined;
    let installationId: number | undefined;
    for (const connection of await sourceControl.connections.list({
      orgId: input.binding.orgId,
      factoryProjectId: input.binding.factoryProjectId,
    })) {
      const installation = await sourceControl.installations.get({
        orgId: input.binding.orgId,
        id: connection.installationId,
      });
      if (!installation) continue;
      for (const link of await sourceControl.projectRepositories.list({
        orgId: input.binding.orgId,
        connectionId: connection.id,
      })) {
        const repository = await sourceControl.repositories.get({ orgId: input.binding.orgId, id: link.repositoryId });
        if (!repository || repository.slug.toLowerCase() !== repositorySlug.toLowerCase()) continue;
        repositoryId = Number(repository.externalId);
        installationId = Number(installation.externalId);
        break;
      }
      if (repositoryId !== undefined) break;
    }
    const pullRequestNumber = Number(match[2]);
    const [owner, repo] = repositorySlug.split('/');
    if (
      !owner ||
      !repo ||
      repositoryId === undefined ||
      installationId === undefined ||
      !Number.isInteger(repositoryId) ||
      !Number.isInteger(installationId) ||
      !Number.isInteger(pullRequestNumber) ||
      pullRequestNumber < 1
    )
      return;
    const targetKey = `factory-pr-provenance:${repositoryId}:${pullRequestNumber}`;
    if (
      (await integrationStorage.subscriptions.listByTarget(targetKey)).some(row => row.orgId === input.binding.orgId)
    ) {
      return;
    }

    // Verification is best-effort: a confirmed mismatch (the API answers and
    // the PR isn't what the tool output claimed) fails closed, but an
    // unavailable API (broken installation token, network) must NOT block the
    // record — this row is the real-time signal the PR auto-link depends on,
    // and it is only consumed when a genuine event for this exact
    // (repository, PR number) arrives later.
    let verified = false;
    try {
      const { data } = await github
        .getInstallationOctokit(installationId)
        .pulls.get({ owner, repo, pull_number: pullRequestNumber });
      if (data.base.repo.id !== repositoryId || data.number !== pullRequestNumber || data.html_url !== url) return;
      verified = true;
    } catch (error) {
      console.warn('[Factory] Recording unverified PR provenance; verification fetch failed', {
        pullRequestUrl: url,
        workItemId: input.item.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    await integrationStorage.subscriptions.create({
      orgId: input.binding.orgId,
      targetKey,
      threadId: input.binding.threadId,
      status: 'active',
      data: {
        kind: 'factory-pr-provenance',
        bindingId: input.binding.id,
        workItemId: input.item.id,
        repositoryId,
        pullRequestNumber,
        pullRequestUrl: url,
        assistantMessageId: input.assistantMessageId,
        toolCallId: input.toolCallId,
        verified,
      },
    });
  } catch (error) {
    // Best-effort by design, but never silently: a swallowed failure here
    // is exactly what breaks the PR auto-link later.
    console.warn('[Factory] Failed to record PR provenance', {
      pullRequestUrl: url,
      workItemId: input.item.id,
      error: error instanceof Error ? error.message : String(error),
    });
    return;
  }
}
