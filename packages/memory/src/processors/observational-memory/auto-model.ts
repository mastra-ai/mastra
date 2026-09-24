import { OBSERVATIONAL_MEMORY_DEFAULTS } from './constants';

/**
 * Low-cost model `'auto'` resolves to, per main-model provider. Google reuses this package's
 * default observation model. Callers can replace entries with `autoModels`.
 */
export const AUTO_MODEL_BY_PROVIDER: Readonly<Record<string, string>> = {
  google: OBSERVATIONAL_MEMORY_DEFAULTS.observation.model,
  anthropic: 'anthropic/claude-haiku-4-5',
  openai: 'openai/gpt-5.4-mini',
  'openai-codex': 'openai/gpt-5.4-mini',
  deepseek: 'deepseek/deepseek-v4-flash',
};

/** Route prefix kept on the pick so it travels the same gateway as the main model. */
const ROUTE_PREFIX = 'mastra/';

export interface ResolveAutoModelIdOptions {
  /** Per-provider low-cost model overrides, e.g. `{ google: 'google/gemini-3.5-flash' }`. */
  autoModels?: Record<string, string>;
}

function hasGoogleGenerativeAIKey(): boolean {
  return typeof process !== 'undefined' && Boolean(process.env.GOOGLE_GENERATIVE_AI_API_KEY);
}

/**
 * Resolve the concrete model ID `'auto'` selects for a main model ID.
 *
 * Order: Gemini when `GOOGLE_GENERATIVE_AI_API_KEY` is set; else the main provider's low-cost
 * model (keeping a `mastra/` gateway prefix); else the main model ID itself. Returns `undefined`
 * only when there is no Google key and no main model ID.
 */
export function resolveAutoModelId(
  mainModelId: string | undefined,
  options?: ResolveAutoModelIdOptions,
): string | undefined {
  const models = { ...AUTO_MODEL_BY_PROVIDER, ...options?.autoModels };
  if (hasGoogleGenerativeAIKey() && models.google) {
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
