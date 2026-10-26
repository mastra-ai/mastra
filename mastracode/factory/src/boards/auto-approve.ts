import { evaluateRuleGroup } from '../rules/rule-group.js';
import type { WorkItemRow } from '../storage/domains/work-items/base.js';
import type { BoardResolver } from './resolver.js';
import { boardForWorkItem } from './semantics.js';

/** The card fields an `autoApproveWhen` condition can test (the intake-route field names). */
export function cardRuleFacts(item: WorkItemRow): Record<string, unknown> {
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
          'source.kind': source.type === 'pull-request' ? 'pull_request' : 'issue',
          'source.integration': source.integrationId,
        }
      : {}),
  };
}

/**
 * Whether the card's current phase approves its exit tool without a person: the
 * stored phase's `autoApproveWhen` matches the card. A card in several phases, or on a
 * board that is not stored, never auto-approves this way.
 */
export async function phaseAutoApproves(resolver: BoardResolver, item: WorkItemRow): Promise<boolean> {
  if (item.stages.length !== 1) return false;
  const phase = await resolver.storedPhase(item, boardForWorkItem(item), item.stages[0]!);
  if (!phase?.exitTool || !phase.autoApproveWhen) return false;
  return evaluateRuleGroup(phase.autoApproveWhen, cardRuleFacts(item));
}
