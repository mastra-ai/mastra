/**
 * Which half of a card owns each metadata key.
 *
 * Provider keys are facts the provider reports (labels, author, state, the
 * repository id an issue lives in); they move to the work item and only a
 * provider sync writes them. Board keys are Factory's own: process state the
 * runs and rules keep (the open PR a card is building, review rounds, the
 * repository a card targets) and the trust stamps that decide whether agents
 * may act on the card. Any key not listed is treated as Factory-owned, because
 * custom board rules file their own process keys.
 */

/** Provider facts every provider may report. */
export const SHARED_PROVIDER_METADATA_KEYS = [
  'assignee',
  'assignees',
  'author',
  'createdAt',
  'creator',
  // Provider sync backoff: the provider stopped returning the item.
  'externalSourceMissingAt',
  'identifier',
  'issueRef',
  'labels',
  'labelColors',
  'number',
  'priority',
  'sourceCreatedAt',
  'state',
  'stateType',
  'updatedAt',
] as const;

/** Factory-owned keys that stay on the board item. */
export const BOARD_METADATA_KEYS = [
  // Trust stamps: Factory's judgement of the source, not a provider fact.
  // `rules/types.ts` fails closed when they are missing.
  'authorTrusted',
  'factoryAuthored',
  'autoStartCandidate',
  'autonomyArmedAt',
  // Dispatcher and reconciler bookkeeping.
  'factoryRuleMaterializationKey',
  'factoryPullRequestReconciliation',
  // The pull request a work card is building, and what Factory saw of it.
  'openPullRequestNumber',
  'pullRequestHeadAt',
  'pullRequestHeadSha',
  'pullRequestHeadDeliveryId',
  'mergeRequestEvents',
  // Review state.
  'reviewVerdict',
  'reviewedAt',
  'reviewedHeadSha',
  'selfReviewFindings',
  'selfReviewNeedsHuman',
  'selfReviewRounds',
  'selfReviewVerdict',
  'selfReviewedAt',
  'selfReviewedHeadSha',
  // The repository a card's runs work in.
  'repository',
] as const;

export interface SplitCardMetadata {
  provider: Record<string, unknown> | null;
  board: Record<string, unknown> | null;
}

/** Split a legacy card's metadata into its work item and board item halves. */
export function splitCardMetadata(
  metadata: Record<string, unknown> | null | undefined,
  providerKeys: readonly string[],
): SplitCardMetadata {
  if (!metadata) return { provider: null, board: null };
  const owned = new Set(providerKeys);
  const provider: Record<string, unknown> = {};
  const board: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    (owned.has(key) ? provider : board)[key] = value;
  }
  return {
    provider: Object.keys(provider).length > 0 ? provider : null,
    board: Object.keys(board).length > 0 ? board : null,
  };
}

export function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

export function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap(entry => {
    if (typeof entry === 'string') return [entry];
    // GitHub-shaped label objects.
    if (entry && typeof entry === 'object' && typeof (entry as { name?: unknown }).name === 'string') {
      return [(entry as { name: string }).name];
    }
    return [];
  });
}
