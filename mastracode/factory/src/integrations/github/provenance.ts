import type { FactoryRuleJsonValue } from '../../rules/types.js';
import type { IntegrationStorageHandle } from '../../storage/domains/integrations/base.js';
import type { SourceControlStorageHandle } from '../../storage/domains/source-control/base.js';
import type { FactoryRunBindingRecord, WorkItemRow, WorkItemsStorage } from '../../storage/domains/work-items/base.js';
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
  factoryProjectId: string;
  repositoryId: number;
  pullRequestNumber: number;
  pullRequestUrl: string;
  assistantMessageId: string;
  toolCallId: string;
}

export async function resolveFactoryPullRequestParentWorkItemId(
  integrationStorage: IntegrationStorageHandle<
    Record<string, unknown>,
    Record<string, unknown>,
    FactoryPullRequestProvenanceData
  >,
  input: { orgId: string; factoryProjectId: string; repositoryId: number; pullRequestNumber: number },
): Promise<string | null> {
  const targetKey = `factory-pr-provenance:${input.repositoryId}:${input.pullRequestNumber}`;
  // Provenance is scoped to the Factory project whose run authored the PR.
  // Rows from a sibling project in the same org — or legacy rows without the
  // project stamp — fail closed rather than linking another project's card.
  const provenance = (await integrationStorage.subscriptions.listByTarget(targetKey, { status: 'active' })).find(
    row =>
      row.orgId === input.orgId &&
      row.data?.kind === 'factory-pr-provenance' &&
      row.data.factoryProjectId === input.factoryProjectId,
  );
  return provenance?.data?.workItemId ?? null;
}

export async function recordFactoryPullRequestProvenance(
  github: GithubIntegration,
  sourceControl: SourceControlStorageHandle,
  integrationStorage: IntegrationStorageHandle<
    Record<string, unknown>,
    Record<string, unknown>,
    FactoryPullRequestProvenanceData
  >,
  workItems: WorkItemsStorage,
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
    // Dedupe within the authoring project only: a sibling project's row must
    // not block this project from recording its own provenance.
    if (
      (await integrationStorage.subscriptions.listByTarget(targetKey)).some(
        row => row.orgId === input.binding.orgId && row.data?.factoryProjectId === input.binding.factoryProjectId,
      )
    ) {
      return;
    }

    const { data } = await github
      .getInstallationOctokit(installationId)
      .pulls.get({ owner, repo, pull_number: pullRequestNumber });
    if (data.base.repo.id !== repositoryId || data.number !== pullRequestNumber || data.html_url !== url) return;

    await integrationStorage.subscriptions.create({
      orgId: input.binding.orgId,
      targetKey,
      threadId: input.binding.threadId,
      status: 'active',
      data: {
        kind: 'factory-pr-provenance',
        bindingId: input.binding.id,
        workItemId: input.item.id,
        factoryProjectId: input.binding.factoryProjectId,
        repositoryId,
        pullRequestNumber,
        pullRequestUrl: url,
        assistantMessageId: input.assistantMessageId,
        toolCallId: input.toolCallId,
      },
    });

    const reviewItem = (
      await workItems.list({
        orgId: input.binding.orgId,
        factoryProjectId: input.binding.factoryProjectId,
      })
    ).find(
      item =>
        item.externalSource?.integrationId === 'github' &&
        item.externalSource.type === 'pull-request' &&
        (item.externalSource.externalId === `github-pr:${pullRequestNumber}` ||
          item.externalSource.externalId === `github:${repositoryId}:pull-request:${pullRequestNumber}`),
    );
    if (reviewItem) {
      await workItems.setParentWorkItemIfMissing({
        orgId: input.binding.orgId,
        id: reviewItem.id,
        userId: 'factory-pr-provenance',
        parentWorkItemId: input.item.id,
      });
    }
  } catch {
    return;
  }
}
