import type { RuleFacts } from '../rules/rule-group.js';
import type { WorkItemRow } from '../storage/domains/work-items/base.js';

/**
 * What a phase condition (`autoStartWhen`, `exitTool.autoApproveWhen`, `agentEnterWhen`) can test
 * about a card. `item.phase` is the phase the card is in now, so on entry it names where it comes from.
 */
export function cardRuleFacts(item: Pick<WorkItemRow, 'title' | 'metadata' | 'externalSource' | 'stages'>): RuleFacts {
  const metadata = item.metadata ?? {};
  const labels = Array.isArray(metadata.labels)
    ? metadata.labels.filter((label): label is string => typeof label === 'string')
    : [];
  const source = item.externalSource;
  const phase = item.stages[0];
  return {
    'item.labels': labels,
    'item.title': item.title,
    ...(typeof metadata.author === 'string' ? { 'item.author': metadata.author } : {}),
    ...(phase !== undefined ? { 'item.phase': phase } : {}),
    ...(typeof metadata.openPullRequestNumber === 'number'
      ? { 'item.openPullRequest': metadata.openPullRequestNumber }
      : {}),
    ...(typeof metadata.reviewVerdict === 'string' ? { 'item.reviewVerdict': metadata.reviewVerdict } : {}),
    ...(typeof metadata.selfReviewVerdict === 'string' ? { 'item.selfReviewVerdict': metadata.selfReviewVerdict } : {}),
    ...(metadata.selfReviewNeedsHuman === true ? { 'item.selfReviewNeedsHuman': true } : {}),
    ...(source
      ? {
          'source.kind': source.type === 'pull-request' ? 'pull_request' : source.type,
          'source.integration': source.integrationId,
        }
      : {}),
  };
}
