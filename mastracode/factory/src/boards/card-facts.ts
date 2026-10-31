import type { RuleFacts } from '../rules/rule-group.js';
import type { Card } from '../storage/domains/work-items/base.js';

/** What a phase condition (`autoStartWhen`, `exitTool.autoApproveWhen`) can test about a card. */
export function cardRuleFacts(item: Pick<Card, 'title' | 'workItem' | 'externalSource'>): RuleFacts {
  const { labels, author } = item.workItem;
  const source = item.externalSource;
  return {
    'item.labels': labels,
    'item.title': item.title,
    ...(author !== null ? { 'item.author': author } : {}),
    ...(source
      ? {
          'source.kind': source.type === 'pull-request' ? 'pull_request' : source.type,
          'source.integration': source.integrationId,
        }
      : {}),
  };
}
