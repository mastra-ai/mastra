import type { RuleFacts } from '../rules/rule-group.js';
import type { WorkItemRow } from '../storage/domains/work-items/base.js';

/** What a phase condition (`autoStartWhen`, `exitTool.autoApproveWhen`) can test about a card. */
export function cardRuleFacts(item: Pick<WorkItemRow, 'title' | 'metadata' | 'externalSource'>): RuleFacts {
  const metadata = item.metadata ?? {};
  const labels = Array.isArray(metadata.labels)
    ? metadata.labels.filter((label): label is string => typeof label === 'string')
    : [];
  const source = item.externalSource;
  return {
    'item.labels': labels,
    'item.title': item.title,
    ...(typeof metadata.author === 'string' ? { 'item.author': metadata.author } : {}),
    ...(source
      ? {
          'source.kind': source.type === 'pull-request' ? 'pull_request' : source.type,
          'source.integration': source.integrationId,
        }
      : {}),
  };
}
