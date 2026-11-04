import { OBSERVATIONAL_MEMORY_DEFAULTS } from './constants';

/**
 * Low-cost model `'auto'` resolves to, per main-model provider. Google reuses this package's
 * default observation model. Callers can replace entries with `autoModels`.
 */
export const AUTO_MODEL_BY_PROVIDER: Readonly<Record<string, string>> = {
  google: OBSERVATIONAL_MEMORY_DEFAULTS.observation.model,
  anthropic: 'anthropic/claude-haiku-4-5',
  openai: 'openai/gpt-6-luna',
  'openai-codex': 'openai/gpt-6-luna',
  deepseek: 'deepseek/deepseek-v4-flash',
};

/** Route prefix kept on the pick so it travels the same gateway as the main model. */
const ROUTE_PREFIX = 'mastra/';

export interface ResolveAutoModelIdOptions {
  /** Per-provider low-cost model overrides, e.g. `{ google: 'google/gemini-3.5-flash' }`. */
  autoModels?: Record<string, string>;
  /**
   * Whether this caller can authenticate with a provider. Replaces the
   * `GOOGLE_GENERATIVE_AI_API_KEY` check that decides whether Gemini is preferred.
   */
  canUseProvider?: (providerId: string) => boolean;
}

function hasGoogleGenerativeAIKey(): boolean {
  return typeof process !== 'undefined' && Boolean(process.env.GOOGLE_GENERATIVE_AI_API_KEY);
}

/**
 * Resolve the concrete model ID `'auto'` selects for a main model ID.
 *
 * Order: Gemini when Google is usable (`canUseProvider('google')`, or `GOOGLE_GENERATIVE_AI_API_KEY`
 * when no check is given); else the main provider's low-cost
 * model (keeping a `mastra/` gateway prefix); else the main model ID itself. Returns `undefined`
 * only when there is no Google key and no main model ID.
 */
export function resolveAutoModelId(
  mainModelId: string | undefined,
  options?: ResolveAutoModelIdOptions,
): string | undefined {
  const models = { ...AUTO_MODEL_BY_PROVIDER, ...options?.autoModels };
  const googleUsable = options?.canUseProvider ? options.canUseProvider('google') : hasGoogleGenerativeAIKey();
  if (googleUsable && models.google) {
    return models.google;
  }
  if (!mainModelId) {
    return undefined;
  }

  const prefix = mainModelId.startsWith(ROUTE_PREFIX) ? ROUTE_PREFIX : '';
  const provider = mainModelId.slice(prefix.length).split('/', 1)[0];
  const pick = provider ? models[provider] : undefined;
  return pick ? `${prefix}${pick}` : mainModelId;
}
