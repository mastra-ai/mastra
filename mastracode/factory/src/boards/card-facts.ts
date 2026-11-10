import type { RuleFacts } from '../rules/rule-group.js';
import { authorTrusted } from '../rules/types.js';
import type { Card } from '../storage/domains/work-items/base.js';
import { workItemProviderAdapter } from '../work-items/providers/index.js';
import { newestOpenPullRequestNumber } from './semantics.js';

/** What a condition (`autoStartWhen`, `exitTool.autoApproveWhen`, an intake route's `when`) can test about a card. */
export function cardRuleFacts(
  item: Pick<Card, 'title' | 'metadata' | 'externalSource'> & {
    workItem?: Pick<Card['workItem'], 'labels' | 'author'> & Partial<Pick<Card['workItem'], 'sources'>>;
  },
): RuleFacts {
  const source = item.externalSource;
  const metadata = item.metadata ?? {};
  const provider = source ? (item.workItem ?? workItemProviderAdapter(source).toSource(source, metadata)) : null;
  const labels = source
    ? (provider?.labels ?? [])
    : Array.isArray(metadata.labels)
      ? metadata.labels.filter((label): label is string => typeof label === 'string')
      : [];
  const pointer = metadata.openPullRequestNumber;
  const pullRequest =
    typeof pointer === 'number' ? pointer : newestOpenPullRequestNumber({ workItem: item.workItem ?? null });
  const author = source ? (provider?.author ?? null) : typeof metadata.author === 'string' ? metadata.author : null;
  return {
    'item.labels': labels,
    'item.title': item.title,
    ...(author !== null ? { 'item.author': author } : {}),
    'author.trusted': authorTrusted(item.metadata),
    // The open change request: the one Factory opened for the card, else its own or an attached open one.
    ...(pullRequest !== null ? { 'item.pullRequest': pullRequest } : {}),
    ...(source
      ? {
          'source.kind': source.type === 'pull-request' ? 'pull_request' : source.type,
          'source.integration': source.integrationId,
        }
      : {}),
  };
}
