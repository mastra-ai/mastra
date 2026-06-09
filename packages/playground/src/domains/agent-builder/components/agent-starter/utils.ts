import type { BuilderModelPolicy } from '@mastra/client-js';
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
 *
 * Preference order:
 *   1. The admin-configured `modelPolicy.default` (so the picker default the
 *      admin explicitly set wins — see PLTFRM-1017).
 *   2. The first entry in the filtered model list (so we still commit to a
 *      model the policy accepts when no explicit default is set).
 *   3. `FALLBACK_MODEL` (so we always have *something* to persist with).
 */
export const resolveStarterModel = (allowedModels: ModelInfo[], policy?: BuilderModelPolicy): StarterModel => {
  if (policy?.active && policy.default) {
    return { provider: policy.default.provider, name: policy.default.modelId };
  }

  const first = allowedModels[0];

  if (first) return { provider: first.provider, name: first.model };

  return FALLBACK_MODEL;
};

/**
 * Returns true when the form's `name` value is still the auto-generated
 * placeholder derived from the original starter prompt. Used by the form
 * snapshot so the builder LLM knows it needs to call `set-agent-name`.
 */
export const isPlaceholderAgentName = (name: string | undefined, originalPrompt: string | undefined): boolean => {
  if (typeof name !== 'string' || name.length === 0) return false;
  if (typeof originalPrompt !== 'string' || originalPrompt.length === 0) return false;
  return name === truncateName(originalPrompt);
};

export const truncateName = (prompt: string): string => (prompt.length <= 20 ? prompt : prompt.slice(0, 20) + '…');
