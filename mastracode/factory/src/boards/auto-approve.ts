import { evaluateRuleGroup } from '../rules/rule-group.js';
import type { StoredExitTool, StoredPhase } from '../storage/domains/boards/base.js';
import type { WorkItemRow } from '../storage/domains/work-items/base.js';
import type { BoardResolver } from './resolver.js';
import { boardForWorkItem } from './semantics.js';

/** The card fields an `exitTool.autoApproveWhen` condition can test (the intake-route field names). */
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

/** A working phase that names no exit tool ends when its agent moves the card, approved without a person. */
export const DEFAULT_EXIT_TOOL: StoredExitTool = Object.freeze({
  id: 'factory_transition_work_item',
  autoApprove: true,
  autoApproveWhen: null,
});

/** The exit tool of a stored phase, falling back to {@link DEFAULT_EXIT_TOOL} for a working phase. */
export function phaseExitTool(phase: StoredPhase | null | undefined): StoredExitTool | undefined {
  if (!phase) return undefined;
  return phase.exitTool ?? (phase.kind === 'working' ? DEFAULT_EXIT_TOOL : undefined);
}

/**
 * The tool the card's current phase approves without a person: the stored phase's
 * exit tool when it has `autoApprove` and its `autoApproveWhen` (if any) matches the
 * card. A card in several phases, or on a board that is not stored, gets none.
 */
export async function autoApprovedExitTool(resolver: BoardResolver, item: WorkItemRow): Promise<string | undefined> {
  if (item.stages.length !== 1) return undefined;
  const exitTool = phaseExitTool(await resolver.storedPhase(item, boardForWorkItem(item), item.stages[0]!));
  if (!exitTool?.autoApprove) return undefined;
  if (exitTool.autoApproveWhen && !evaluateRuleGroup(exitTool.autoApproveWhen, cardRuleFacts(item))) return undefined;
  return exitTool.id;
}
