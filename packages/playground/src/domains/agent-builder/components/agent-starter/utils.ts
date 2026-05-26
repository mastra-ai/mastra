import { FALLBACK_MODEL } from './constants';
import type { ModelInfo } from '@/domains/llm/hooks/use-filtered-models';

export type StarterModel = {
  provider: string;
  name: string;
};

/**
 * Picks a model the server will accept for the new agent. The starter has to
 * commit to *some* model up front (visibility/persistence happens before the
 * user reaches the configure panel), but we deliberately reuse the same
 * filtered list the picker shows so we never propose a model the admin policy
 * blocks. Users override this immediately on the next screen.
 */
export const resolveStarterModel = (allowedModels: ModelInfo[]): StarterModel => {
  const first = allowedModels[0];

  if (first) return { provider: first.provider, name: first.model };

  return FALLBACK_MODEL;
};

export const truncateName = (prompt: string): string => (prompt.length <= 20 ? prompt : prompt.slice(0, 20) + '…');
