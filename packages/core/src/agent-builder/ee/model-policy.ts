import type { ProviderModelEntry } from './types';

export const MODEL_NOT_ALLOWED_CODE = 'MODEL_NOT_ALLOWED' as const;

/**
 * Candidate model to check against the allowlist.
 */
export interface ModelMatchCandidate {
  provider: string;
  modelId: string;
}

export type IsModelAllowedByPolicyOptions = {
  isProviderRegistered?: (providerId: string) => boolean;
};

/**
 * Single-entry match: provider equality (case-sensitive). When the entry omits
 * `modelId` it matches every model under that provider (provider wildcard).
 */
export function matchesProvider(entry: ProviderModelEntry, candidate: ModelMatchCandidate): boolean {
  if (entry.provider !== candidate.provider) return false;
  if (!entry.modelId) return true;
  return entry.modelId === candidate.modelId;
}

function isCustomProviderEntry(entry: ProviderModelEntry): boolean {
  return 'kind' in entry && entry.kind === 'custom';
}

/**
 * Shared allowlist evaluation that stays browser-safe by accepting provider
 * registration as an optional caller-supplied predicate.
 */
export function isModelAllowedByPolicy(
  allowed: ProviderModelEntry[] | undefined,
  candidate: ModelMatchCandidate,
  { isProviderRegistered }: IsModelAllowedByPolicyOptions = {},
): boolean {
  if (allowed === undefined) return true;
  if (allowed.length === 0) return true;

  const activeEntries = isProviderRegistered
    ? allowed.filter(entry => isCustomProviderEntry(entry) || isProviderRegistered(entry.provider))
    : allowed;

  if (activeEntries.length === 0) return false;

  return activeEntries.some(entry => matchesProvider(entry, candidate));
}
