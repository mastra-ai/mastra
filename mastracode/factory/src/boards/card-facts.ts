import type { RuleFacts } from '../rules/rule-group.js';
import { authorTrusted } from '../rules/types.js';
import type { Card } from '../storage/domains/work-items/base.js';
import { pullRequestSources, reviewedPullRequest } from '../work-items/change-requests.js';
import { workItemProviderAdapter } from '../work-items/providers/index.js';
import { stringList, stringValue } from '../work-items/providers/metadata-keys.js';
import { newestOpenPullRequestNumber, trustedPullRequestSource } from './semantics.js';

type WorkItemFacts = Pick<Card['workItem'], 'labels' | 'author'> &
  Partial<Pick<Card['workItem'], 'sources' | 'provider' | 'key' | 'state' | 'metadata'>>;

/** Who an item is assigned to, as the provider reports it: a list, or the one assignee. */
function assignees(metadata: Record<string, unknown> | null): string[] {
  const listed = stringList(metadata?.assignees);
  if (listed.length > 0) return listed;
  const one = stringValue(metadata?.assignee);
  return one ? [one] : [];
}

/** What a condition (`autoStartWhen`, `exitTool.autoApproveWhen`, an intake route's `when`) can test about a card. */
export function cardRuleFacts(
  item: Pick<Card, 'title' | 'metadata' | 'externalSource'> & { workItem?: WorkItemFacts },
): RuleFacts {
  const source = item.externalSource;
  const metadata = item.metadata ?? {};
  const adapter = source ? workItemProviderAdapter(source) : null;
  // A card's work item holds what its provider reported; an arrival not filed yet is normalized
  // from its source and metadata the way its work item will be.
  const normalized = source ? adapter!.toSource(source, metadata) : null;
  const stored = item.workItem;
  const labels = source
    ? ((stored ?? normalized)?.labels ?? [])
    : Array.isArray(metadata.labels)
      ? metadata.labels.filter((label): label is string => typeof label === 'string')
      : [];
  const pointer = metadata.openPullRequestNumber;
  const pullRequest =
    typeof pointer === 'number' ? pointer : newestOpenPullRequestNumber({ workItem: item.workItem ?? null });
  // Whether the card's working pull request comes from someone with write access: a pull
  // request's own card is its author; an issue card's is the attached one it works on.
  const working =
    source?.type === 'pull-request' ? undefined : reviewedPullRequest({ ...item, workItem: item.workItem ?? null });
  const pullRequestTrusted =
    source?.type === 'pull-request'
      ? authorTrusted(item.metadata)
      : working
        ? trustedPullRequestSource(item, working)
        : undefined;
  const author = source
    ? ((stored ?? normalized)?.author ?? null)
    : typeof metadata.author === 'string'
      ? metadata.author
      : null;
  const key = stored?.key ?? normalized?.key ?? null;
  const state = stored?.state ?? normalized?.state ?? null;
  const providerMetadata = stored?.metadata ?? normalized?.metadata ?? null;
  const repository = adapter?.repository?.({ key, metadata: providerMetadata }) ?? null;
  const sources = item.workItem?.sources ?? [];
  // A pull request's own card is the pull request: only one attached alongside its own source counts.
  const ownPullRequest = source?.type === 'pull-request';
  const attachedOpenPullRequest =
    (typeof pointer === 'number' && !ownPullRequest) ||
    (ownPullRequest
      ? newestOpenPullRequestNumber({ workItem: { sources: sources.slice(1) } }) !== null
      : pullRequest !== null);
  // A pull request linked to an issue: the card holds both a pull request and an issue source.
  const linksIssue =
    pullRequestSources({ workItem: item.workItem ?? null }).length > 0 &&
    sources.some(entry => entry.sourceType !== 'pull-request');
  return {
    'item.labels': labels,
    'item.title': item.title,
    ...(author !== null ? { 'item.author': author } : {}),
    ...(key !== null ? { 'item.key': key } : {}),
    ...(state !== null ? { 'item.state': state } : {}),
    'item.assignees': assignees(source ? providerMetadata : metadata),
    'item.trusted': authorTrusted(item.metadata),
    ...(pullRequestTrusted !== undefined ? { 'pullRequest.trusted': pullRequestTrusted } : {}),
    // The open change request: the one Factory opened for the card, else its own or an attached open one.
    ...(pullRequest !== null ? { 'item.pullRequest': pullRequest } : {}),
    'item.hasPullRequest': attachedOpenPullRequest,
    'item.hasIssue': linksIssue,
    ...(source
      ? {
          'source.kind': source.type === 'pull-request' ? 'pull_request' : source.type,
          'source.integration': source.integrationId,
          'source.provider': stored?.provider ?? normalized?.provider ?? source.integrationId,
          ...(repository !== null ? { 'source.repository': repository } : {}),
        }
      : {}),
  };
}
